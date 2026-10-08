// Js/invigilator-dashboard.js

const firebaseConfig = {
    apiKey: "AIzaSyCuYIuB_I9OrrTx6Qox6GnUerkN_vDgIHI",
    authDomain: "ssc-exam-project-8af6b.firebaseapp.com",
    projectId: "ssc-exam-project-8af6b",
    storageBucket: "ssc-exam-project-8af6b.firebasestorage.app",
    messagingSenderId: "288245274853",
    appId: "1:288245274853:web:b4d535a08faf305f5e9c0c",
    measurementId: "G-4BTLY67VDS"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let sessionTimer = null;
let inactivityTimer = null;

const SESSION_TIME = 8 * 60 * 60 * 1000;
const INACTIVITY_TIME = 30 * 60 * 1000;


/* =========================================
   AUTH CHECK
========================================= */

auth.onAuthStateChanged(async function(user) {

    if (!user) {
        redirectToLogin();
        return;
    }

    try {

        const doc = await db
            .collection("invigilators")
            .doc(user.uid)
            .get();

        if (!doc.exists) {
            await logoutInvigilator();
            return;
        }

        const data = doc.data() || {};

        const role =
            String(data.role || "")
            .trim()
            .toLowerCase();

        const status =
            String(data.status || "")
            .trim()
            .toLowerCase();

        if (
            role !== "invigilator" ||
            status !== "active"
        ) {
            await logoutInvigilator();
            return;
        }


        /* =====================================
           SESSION DATA
        ===================================== */

        sessionStorage.setItem(
            "userRole",
            "invigilator"
        );

        sessionStorage.setItem(
            "invigilatorUid",
            user.uid
        );

        sessionStorage.setItem(
            "invigilatorEmail",
            user.email || data.email || ""
        );

        sessionStorage.setItem(
            "invigilatorName",
            data.fullName ||
            data.name ||
            "Invigilator"
        );

        sessionStorage.setItem(
            "invigilatorId",
            data.employeeId ||
            data.invigilatorId ||
            ""
        );

        sessionStorage.setItem(
            "invigilatorCentre",
            data.centre ||
            data.center ||
            ""
        );


        /* =====================================
           DISPLAY DATA
        ===================================== */

        setText(
            "invigilatorName",
            data.fullName ||
            data.name ||
            "Invigilator"
        );

        setText(
            "invigilatorEmail",
            data.email ||
            user.email ||
            ""
        );

        setText(
            "invigilatorId",
            data.employeeId ||
            data.invigilatorId ||
            ""
        );

        setText(
            "invigilatorCentre",
            data.centre ||
            data.center ||
            ""
        );


        /* =====================================
           START SESSION
        ===================================== */

        startSessionTimer();
        startInactivityTimer();

    }
    catch(error) {

        console.error(
            "Dashboard Error:",
            error
        );

        await logoutInvigilator();
    }
});


/* =========================================
   SET TEXT
========================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


/* =========================================
   SESSION TIMER
========================================= */

function startSessionTimer() {

    clearTimeout(sessionTimer);

    sessionTimer = setTimeout(
        function() {

            alert(
                "Your session has expired. Please login again."
            );

            logoutInvigilator();

        },
        SESSION_TIME
    );
}


/* =========================================
   INACTIVITY TIMER
========================================= */

function startInactivityTimer() {

    clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(
        function() {

            alert(
                "You have been inactive for 30 minutes. Please login again."
            );

            logoutInvigilator();

        },
        INACTIVITY_TIME
    );
}


/* =========================================
   RESET INACTIVITY TIMER
========================================= */

function resetInactivityTimer() {

    clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(
        function() {

            alert(
                "You have been inactive for 30 minutes. Please login again."
            );

            logoutInvigilator();

        },
        INACTIVITY_TIME
    );
}


/* =========================================
   USER ACTIVITY
========================================= */

[
    "click",
    "mousemove",
    "keydown",
    "touchstart",
    "scroll"
].forEach(function(eventName) {

    document.addEventListener(
        eventName,
        resetInactivityTimer,
        {
            passive: true
        }
    );

});


/* =========================================
   LOGOUT
========================================= */

async function logoutInvigilator() {

    clearTimeout(sessionTimer);
    clearTimeout(inactivityTimer);

    sessionStorage.removeItem(
        "userRole"
    );

    sessionStorage.removeItem(
        "invigilatorUid"
    );

    sessionStorage.removeItem(
        "invigilatorEmail"
    );

    sessionStorage.removeItem(
        "invigilatorName"
    );

    sessionStorage.removeItem(
        "invigilatorId"
    );

    sessionStorage.removeItem(
        "invigilatorCentre"
    );

    try {

        await auth.signOut();

    }
    catch(error) {

        console.error(
            "Logout Error:",
            error
        );

    }

    redirectToLogin();
}


/* =========================================
   REDIRECT
========================================= */

function redirectToLogin() {

    window.location.replace(
        "invigilator_login.html"
    );
}


/* =========================================
   LOGOUT BUTTON SUPPORT
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                function() {

                    logoutInvigilator();

                }
            );

        }

    }
);