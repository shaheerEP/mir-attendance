
async function checkRedirect() {
    try {
        const response = await fetch("https://mir-attendance.vercel.app/api/status", {
            method: 'HEAD',
            redirect: 'manual'
        });
        console.log("Status:", response.status);
        console.log("Location:", response.headers.get("location"));
    } catch (error) {
        console.error("Error:", error);
    }
}

checkRedirect();
