import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        },
    }
);

// Protect everything except:
// - /login (Login page)
// - /api/attendance (Hardware endpoint must be public)
// - /_next (Next.js internals)
// - /static (Static files)
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - login (Login page)
         * - api/attendance (Hardware endpoint, exclude subpaths if any or be precise)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!login|api/attendance|_next/static|_next/image|favicon.ico).*)",
    ],
};
