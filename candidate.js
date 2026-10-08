// ============================================
// SSC EXAMINATION SYSTEM
// CANDIDATE REGISTRATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCuYIuB_I9OrrTx6Qox6GnUerkN_vDgIHI",
    authDomain: "ssc-exam-project-8af6b.firebaseapp.com",
    projectId: "ssc-exam-project-8af6b",
    storageBucket: "ssc-exam-project-8af6b.firebasestorage.app",
    messagingSenderId: "288245274853",
    appId: "1:288245274853:web:b4d535a08faf305f5e9c0c",
    measurementId: "G-4BTLY67VDS"
};


// Firebase initialize
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();


// Elements
const form = document.getElementById("registrationForm");

const message = document.getElementById("message");

const button = document.getElementById("registerButton");


// Message function
function showMessage(text, success = false) {

    message.textContent = text;

    message.style.color =
        success ? "#15803d" : "#dc2626";
}


// Registration
form.addEventListener("submit", async function (e) {

    e.preventDefault();

    showMessage("");

    const fullName =
        document.getElementById("fullName")
        .value.trim();

    const dateOfBirth =
        document.getElementById("dob")
        .value;

    const mobile =
        document.getElementById("mobile")
        .value.trim();

    const email =
        document.getElementById("email")
        .value.trim()
        .toLowerCase();

    const exam =
        document.getElementById("exam")
        .value;

    const centre =
        document.getElementById("centre")
        .value;

    const password =
        document.getElementById("password")
        .value;

    const confirmPassword =
        document.getElementById("confirmPassword")
        .value;

    const terms =
        document.getElementById("terms")
        .checked;


    // Validation

    if (fullName.length < 3) {

        showMessage("Enter a valid full name.");

        return;
    }


    if (!dateOfBirth) {

        showMessage("Please select date of birth.");

        return;
    }


    if (!/^[6-9][0-9]{9}$/.test(mobile)) {

        showMessage(
            "Enter a valid 10-digit mobile number."
        );

        return;
    }


    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

        showMessage("Enter a valid email address.");

        return;
    }


    if (!exam) {

        showMessage("Please select examination.");

        return;
    }


    if (!centre) {

        showMessage(
            "Please select examination centre."
        );

        return;
    }


    if (password.length < 6) {

        showMessage(
            "Password must contain at least 6 characters."
        );

        return;
    }


    if (password !== confirmPassword) {

        showMessage(
            "Password and Confirm Password do not match."
        );

        return;
    }


    if (!terms) {

        showMessage(
            "Please accept the terms and conditions."
        );

        return;
    }


    // Disable button

    button.disabled = true;

    button.textContent =
        "Creating Account...";


    try {

        // Create Authentication account

        const result =
            await auth.createUserWithEmailAndPassword(
                email,
                password
            );


        const user = result.user;


        // Set display name

        await user.updateProfile({
            displayName: fullName
        });


        // Save candidate

        await db
            .collection("candidates")
            .doc(user.uid)
            .set({

                uid: user.uid,

                fullName: fullName,

                dateOfBirth: dateOfBirth,

                mobile: mobile,

                email: email,

                exam: exam,

                centre: centre,

                role: "candidate",

                status: "active",

                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()

            });


        // Save user role

        await db
            .collection("users")
            .doc(user.uid)
            .set({

                uid: user.uid,

                fullName: fullName,

                email: email,

                role: "candidate",

                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()

            });


        // Success

        showMessage(
            "Registration successful! Redirecting...",
            true
        );


        form.reset();


        setTimeout(function () {

            window.location.href =
                "login.html";

        }, 2000);


    } catch (error) {

        console.error(error);

        let errorText =
            "Registration failed.";


        switch (error.code) {

            case "auth/email-already-in-use":

                errorText =
                    "This email is already registered.";

                break;


            case "auth/invalid-email":

                errorText =
                    "Invalid email address.";

                break;


            case "auth/weak-password":

                errorText =
                    "Password must contain at least 6 characters.";

                break;


            case "auth/network-request-failed":

                errorText =
                    "Internet connection problem.";

                break;


            case "auth/operation-not-allowed":

                errorText =
                    "Email/Password Authentication is disabled.";

                break;


            case "permission-denied":

                errorText =
                    "Firestore permission denied.";

                break;


            default:

                errorText =
                    error.message ||
                    "Something went wrong.";

        }


        showMessage(errorText);


        button.disabled = false;

        button.textContent =
            "Register Candidate";

    }

});