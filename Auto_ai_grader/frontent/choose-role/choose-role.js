let role = "TEACHER";

const teacher = document.getElementById("teacher");
const student = document.getElementById("student");

teacher.onclick = () => {
    role = "TEACHER";
    teacher.classList.add("active");
    student.classList.remove("active");
};

student.onclick = () => {
    role = "STUDENT";
    student.classList.add("active");
    teacher.classList.remove("active");
};

// Read temporary token from URL
const params = new URLSearchParams(window.location.search);
const tempToken = params.get("token");

if (!tempToken) {
    alert("Invalid or expired OAuth session.");
    window.location.href = "../login/index.html";
}

document.getElementById("continueBtn").onclick = async () => {

    const res = await fetch(
        "http://localhost:5000/api/auth/oauth/register",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${tempToken}`
            },

            credentials: "include",

            body: JSON.stringify({
                role
            })
        }
    );

    const data = await res.json();

    if (!res.ok) {
        alert(data.message || "Registration failed.");
        return;
    }

    if (data.user.role === "TEACHER") {
        window.location.href = "../teacher_dashboard/index.html";
    } else {
        window.location.href = "../student_dashboard/index.html";
    }

};