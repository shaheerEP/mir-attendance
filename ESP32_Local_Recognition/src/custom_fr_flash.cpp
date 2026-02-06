#include "custom_fr_flash.h"
#include "Arduino.h"
#include "esp_partition.h"
#include <cstring>

// --------------------------------------------------------------------------
// Custom Flash Persistence for ESP-WHO Face Recognition
// --------------------------------------------------------------------------

// Structure of data saved in Flash:
// [Magic Header (4 bytes)] [Count (4 bytes)]
// [Face 1: N(4), W(4), H(4), C(4), Data(Float*Size)...]
// [Face 2...]

// We update Magic to invalid old data and force new dynamic format
#define PARTITION_NAME "fr"
#define MAGIC_HEADER 0xFACE0002 // Updated v2

// Helper to get partition
const esp_partition_t *get_fr_partition() {
  const esp_partition_t *part = esp_partition_find_first(
      ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, PARTITION_NAME);
  if (!part) {
    Serial.println("[CustomFR] Error: 'fr' partition not found!");
  }
  return part;
}

// --------------------------------------------------------------------------
// READ
// --------------------------------------------------------------------------
void read_face_id_from_flash_custom(face_id_list *l) {
  const esp_partition_t *part = get_fr_partition();
  if (!part)
    return;

  Serial.println("[CustomFR] Reading from Flash...");

  uint32_t magic = 0;
  uint32_t stored_count = 0;
  size_t offset = 0;

  // Read Header
  esp_partition_read(part, offset, &magic, sizeof(magic));
  offset += sizeof(magic);

  if (magic != MAGIC_HEADER) {
    Serial.printf(
        "[CustomFR] No valid V2 data found (Magic: 0x%X). Init empty.\n",
        magic);
    return;
  }

  // Read Count
  esp_partition_read(part, offset, &stored_count, sizeof(stored_count));
  offset += sizeof(stored_count);

  if (stored_count > l->size) {
    Serial.printf(
        "[CustomFR] Warning: Stored count (%d) > Max (%d). Truncating.\n",
        stored_count, l->size);
    stored_count = l->size;
  }

  Serial.printf("[CustomFR] Found %d faces.\n", stored_count);

  // Read Faces
  for (int i = 0; i < stored_count; i++) {
    // Read Dimensions
    int n, w, h, c;
    esp_partition_read(part, offset, &n, sizeof(int));
    offset += sizeof(int);
    esp_partition_read(part, offset, &w, sizeof(int));
    offset += sizeof(int);
    esp_partition_read(part, offset, &h, sizeof(int));
    offset += sizeof(int);
    esp_partition_read(part, offset, &c, sizeof(int));
    offset += sizeof(int);

    // Sanity check
    if (n <= 0 || w <= 0 || h <= 0 || c <= 0 ||
        n * w * h * c > 4096) { // Arbitrary safety limit
      Serial.printf(
          "[CustomFR] Invalid dims at face %d: %d,%d,%d,%d. Stopping.\n", i, n,
          w, h, c);
      break;
    }

    int total_floats = n * w * h * c;
    size_t byte_size = total_floats * sizeof(float);

    // Allocate buffer
    float *vec = (float *)malloc(byte_size);
    if (!vec) {
      Serial.println("[CustomFR] Malloc failed for read");
      break;
    }

    esp_partition_read(part, offset, vec, byte_size);
    offset += byte_size;

    // Alloc Matrix DIRECTLY
    dl_matrix3d_t *matrix = dl_matrix3d_alloc(n, w, h, c);

    if (matrix == NULL) {
      free(vec);
      Serial.println("[CustomFR] Matrix alloc failed");
      break;
    }

    // Copy data
    memcpy(matrix->item, vec, byte_size);

    // Debug: Print first 5 floats
    if (n * w * h * c >= 5) {
      float *d = matrix->item;
      Serial.printf("[CustomFR] Face %d Data: %.4f %.4f %.4f %.4f %.4f ...\n",
                    i, d[0], d[1], d[2], d[3], d[4]);
    }

    // Append to list (using correct type dl_matrix3d_t**)
    // l->id_list is defined as `dl_matrix3du_t **` (or `dl_matrix3d_t **`)
    ((dl_matrix3d_t **)l->id_list)[l->count] = matrix;
    l->count++;

    free(vec); // Free temp buffer

    Serial.printf("[CustomFR] Loaded Face %d (n:%d w:%d h:%d c:%d)\n", i, n, w,
                  h, c);
  }

  Serial.println("[CustomFR] Load Complete.");
}

// --------------------------------------------------------------------------
// WRITE (Full Overwrite)
// --------------------------------------------------------------------------
int enroll_face_id_to_flash_custom(face_id_list *l,
                                   dl_matrix3du_t *aligned_face) {
  const esp_partition_t *part = get_fr_partition();
  if (!part)
    return -1;

  // Erase enough space
  // Header (8) + 7 * (Dims(16) + Data(512*4 = 2048)) ~= 7 * 2064 + 8 ~= 14.5KB
  esp_err_t err =
      esp_partition_erase_range(part, 0, SPI_FLASH_SEC_SIZE * 5); // 20KB
  if (err != ESP_OK) {
    Serial.printf("[CustomFR] Erase failed: %s\n", esp_err_to_name(err));
    return -1;
  }

  // Write Header
  uint32_t magic = MAGIC_HEADER;
  uint32_t count = l->count;
  size_t offset = 0;

  esp_partition_write(part, offset, &magic, sizeof(magic));
  offset += sizeof(magic);
  esp_partition_write(part, offset, &count, sizeof(count));
  offset += sizeof(count);

  Serial.printf("[CustomFR] Saving %d faces to Flash...\n", count);

  // Cast to dl_matrix3d_t**
  dl_matrix3d_t **matrices = (dl_matrix3d_t **)l->id_list;

  for (int i = 0; i < count; i++) {
    dl_matrix3d_t *matrix = matrices[i];

    if (matrix) {
      // Get Dims
      int n = matrix->n;
      int w = matrix->w;
      int h = matrix->h;
      int c = matrix->c;
      int total_floats = n * w * h * c;

      // Write Dims
      esp_partition_write(part, offset, &n, sizeof(int));
      offset += sizeof(int);
      esp_partition_write(part, offset, &w, sizeof(int));
      offset += sizeof(int);
      esp_partition_write(part, offset, &h, sizeof(int));
      offset += sizeof(int);
      esp_partition_write(part, offset, &c, sizeof(int));
      offset += sizeof(int);

      // Write Data
      esp_partition_write(part, offset, matrix->item,
                          total_floats * sizeof(float));
      offset += total_floats * sizeof(float);

      // Debug: Print first 5 floats
      if (total_floats >= 5) {
        float *d = matrix->item;
        Serial.printf(
            "[CustomFR] Saving Face %d Data: %.4f %.4f %.4f %.4f %.4f ...\n", i,
            d[0], d[1], d[2], d[3], d[4]);
      }

      Serial.printf("[CustomFR] Saved Face %d (n:%d w:%d h:%d c:%d)\n", i, n, w,
                    h, c);
    } else {
      Serial.printf("[CustomFR] Error: Null matrix at index %d\n", i);
    }
  }

  Serial.println("[CustomFR] Save Complete.");
  return 0;
}

// --------------------------------------------------------------------------
// DELETE (Full Update)
// --------------------------------------------------------------------------
int delete_face_id_in_flash_custom(face_id_list *l) {
  return enroll_face_id_to_flash_custom(l, NULL);
}
