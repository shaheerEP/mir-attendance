#ifndef CUSTOM_FR_FLASH_H
#define CUSTOM_FR_FLASH_H

#include "fd_forward.h"
#include "fr_forward.h"

// Define the name of the partition in partitions.csv
#define FR_PARTITION_NAME "fr"

// Function Declarations
void read_face_id_from_flash_custom(face_id_list *l);
int enroll_face_id_to_flash_custom(face_id_list *l,
                                   dl_matrix3du_t *aligned_face);
int delete_face_id_in_flash_custom(face_id_list *l);

#endif
