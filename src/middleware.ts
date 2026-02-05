import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                const path = req.nextUrl.pathname;
                if (path.startsWith("/api/attendance") ||
                    path.startsWith("/api/recognize") ||
                    path.startsWith("/api/mark-attendance")) {
                    return true;
                }
                return !!token;
            },
        },
        pages: {
            signIn: "/login",
        },
    }
);

export const config = {
    matcher: [
        "/((?!login|api/attendance|api/recognize|api/mark-attendance|_next/static|_next/image|favicon.ico).*)",
    ],
};
