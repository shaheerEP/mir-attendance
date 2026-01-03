import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Import from the route file where we defined it
import { getServerSession } from "next-auth";

export function getSession() {
    return getServerSession(authOptions);
}
