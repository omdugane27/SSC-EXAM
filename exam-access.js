/* =========================================================
   SSC EXAMINATION SYSTEM
   EXAM ACCESS - FINAL VERSION
   ========================================================= */

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

let currentUser = null;
let candidateData = null;
let urlExamId = "";

/* =========================================================
   PAGE ELEMENTS
   ========================================================= */

const pinInput = document.getElementById("examPin");
const verifyButton = document.getElementById("verifyPinBtn");

/* =========================================================
   GET EXAM ID FROM URL
   ========================================================= */

const params = new URLSearchParams(window.location.search);

urlExamId =
  params.get("examId") ||
  params.get("examID") ||
  params.get("id") ||
  "";

/* =========================================================
   AUTH CHECK
   ========================================================= */

auth.onAuthStateChanged(async (user) => {

  if (!user) {

    window.location.href = "login.html";
    return;

  }

  currentUser = user;

  await loadCandidateData();

});


/* =========================================================
   LOAD CANDIDATE
   ========================================================= */

async function loadCandidateData() {

  try {

    const candidateRef =
      db.collection("candidates").doc(currentUser.uid);

    const candidateSnap =
      await candidateRef.get();

    if (!candidateSnap.exists) {

      showError(
        "Candidate profile not found."
      );

      return;

    }

    candidateData = {
      uid: currentUser.uid,
      ...candidateSnap.data()
    };

    displayCandidate(candidateData);

    checkExamAccess(candidateData);

  } catch (error) {

    console.error(
      "Candidate loading error:",
      error
    );

    showError(
      "Unable to load candidate information: " +
      error.message
    );

  }

}


/* =========================================================
   DISPLAY CANDIDATE
   ========================================================= */

function displayCandidate(candidate) {

  setText(
    "candidateName",
    candidate.fullName ||
    candidate.name ||
    "Candidate"
  );

  setText(
    "candidateRoll",
    candidate.rollNumber ||
    "-"
  );

  setText(
    "candidateExam",
    candidate.assignedExamName ||
    "-"
  );

  setText(
    "candidateCentre",
    candidate.centre ||
    candidate.center ||
    "-"
  );

  setText(
    "candidateLab",
    candidate.roomNo ||
    candidate.lab ||
    candidate.room ||
    "-"
  );

  setText(
    "candidateSeat",
    candidate.seatNumber ||
    "-"
  );

}


/* =========================================================
   CHECK EXAM ACCESS
   ========================================================= */

function checkExamAccess(candidate) {

  const assignedExamId =
    candidate.assignedExamId || "";

  const assignmentStatus =
    String(
      candidate.assignmentStatus || ""
    ).toLowerCase();

  /*
    Accept both statuses used by the project:
    allocated / assigned
  */

  if (
    assignmentStatus !== "assigned" &&
    assignmentStatus !== "allocated"
  ) {

    showError(
      "Your examination has not been assigned yet."
    );

    disableVerification();

    return;

  }


  if (
    urlExamId &&
    assignedExamId &&
    urlExamId !== assignedExamId
  ) {

    showError(
      "This examination is not assigned to your account."
    );

    disableVerification();

    return;

  }


  /*
    IMPORTANT:
    Invigilator saves PIN directly inside
    candidates/{UID}.examPin
  */

  const examPin =
    candidate.examPin || "";

  const expiry =
    candidate.examPinExpiresAt || null;


  if (!examPin) {

    showError(
      "Exam access PIN has not been issued by the invigilator yet."
    );

    disableVerification();

    return;

  }


  /*
    Check PIN expiry
  */

  if (expiry) {

    let expiryDate = null;

    try {

      if (
        expiry.toDate &&
        typeof expiry.toDate === "function"
      ) {

        expiryDate =
          expiry.toDate();

      } else {

        expiryDate =
          new Date(expiry);

      }

    } catch (error) {

      console.warn(
        "Expiry conversion failed:",
        error
      );

    }


    if (
      expiryDate &&
      !isNaN(expiryDate.getTime()) &&
      new Date() > expiryDate
    ) {

      showError(
        "This exam access PIN has expired. Please contact the invigilator."
      );

      disableVerification();

      return;

    }

  }


  /*
    PIN exists and is valid
  */

  enableVerification();

}


/* =========================================================
   VERIFY PIN
   ========================================================= */

async function verifyExamPin() {

  if (!currentUser || !candidateData) {

    showError(
      "Candidate information is not ready. Please wait."
    );

    return;

  }


  const enteredPin =
    String(
      pinInput?.value || ""
    ).trim();


  if (!/^\d{6}$/.test(enteredPin)) {

    showError(
      "Please enter a valid 6-digit Exam PIN."
    );

    return;

  }


  const storedPin =
    String(
      candidateData.examPin || ""
    ).trim();


  if (!storedPin) {

    showError(
      "Exam access PIN has not been issued by the invigilator yet."
    );

    return;

  }


  /* =====================================================
     CHECK EXPIRY AGAIN
     ===================================================== */

  const expiry =
    candidateData.examPinExpiresAt || null;

  if (expiry) {

    let expiryDate = null;

    try {

      if (
        expiry.toDate &&
        typeof expiry.toDate === "function"
      ) {

        expiryDate =
          expiry.toDate();

      } else {

        expiryDate =
          new Date(expiry);

      }

    } catch (error) {

      console.warn(error);

    }


    if (
      expiryDate &&
      !isNaN(expiryDate.getTime()) &&
      new Date() > expiryDate
    ) {

      showError(
        "This Exam PIN has expired."
      );

      return;

    }

  }


  /* =====================================================
     COMPARE PIN
     ===================================================== */

  if (enteredPin !== storedPin) {

    showError(
      "Incorrect Exam PIN. Please enter the PIN provided by the invigilator."
    );

    return;

  }


  /* =====================================================
     SUCCESS
     ===================================================== */

  try {

    if (verifyButton) {

      verifyButton.disabled = true;
      verifyButton.textContent =
        "Verified ✓";

    }


    sessionStorage.setItem(
      "examAccessGranted",
      "true"
    );

    sessionStorage.setItem(
      "examAccessTime",
      new Date().toISOString()
    );

    sessionStorage.setItem(
      "candidateId",
      currentUser.uid
    );

    sessionStorage.setItem(
      "examId",
      candidateData.assignedExamId || urlExamId || ""
    );

    sessionStorage.setItem(
      "examName",
      candidateData.assignedExamName || ""
    );

    sessionStorage.setItem(
      "rollNumber",
      candidateData.rollNumber || ""
    );

    sessionStorage.setItem(
      "centre",
      candidateData.centre ||
      candidateData.center ||
      ""
    );

    sessionStorage.setItem(
      "roomNo",
      candidateData.roomNo ||
      candidateData.lab ||
      candidateData.room ||
      ""
    );

    sessionStorage.setItem(
      "seatNumber",
      candidateData.seatNumber || ""
    );


    /*
      Redirect to exam instructions
    */

    setTimeout(() => {

      window.location.href =
        "instructions.html";

    }, 500);


  } catch (error) {

    console.error(
      "Exam access error:",
      error
    );

    showError(
      "Unable to start examination: " +
      error.message
    );

    if (verifyButton) {

      verifyButton.disabled = false;

      verifyButton.textContent =
        "Verify Exam PIN";

    }

  }

}


/* =========================================================
   ENABLE / DISABLE BUTTON
   ========================================================= */

function disableVerification() {

  if (verifyButton) {

    verifyButton.disabled = true;

  }

}


function enableVerification() {

  if (verifyButton) {

    verifyButton.disabled = false;

  }

}


/* =========================================================
   MESSAGE HELPERS
   ========================================================= */

function showError(message) {

  const errorBox =
    document.getElementById("errorMessage") ||
    document.getElementById("message") ||
    document.querySelector(".message");

  if (errorBox) {

    errorBox.textContent =
      message;

    errorBox.style.display =
      "block";

  } else {

    alert(message);

  }

}


function setText(id, value) {

  const element =
    document.getElementById(id);

  if (element) {

    element.textContent =
      value;

  }

}


/* =========================================================
   PIN INPUT
   ========================================================= */

if (pinInput) {

  pinInput.addEventListener(
    "input",
    function() {

      this.value =
        this.value
          .replace(/\D/g, "")
          .slice(0, 6);

    }
  );

}


/* =========================================================
   BUTTON EVENT
   ========================================================= */

if (verifyButton) {

  verifyButton.addEventListener(
    "click",
    verifyExamPin
  );

}


/* =========================================================
   ENTER KEY
   ========================================================= */

if (pinInput) {

  pinInput.addEventListener(
    "keydown",
    function(event) {

      if (event.key === "Enter") {

        event.preventDefault();

        verifyExamPin();

      }

    }
  );

}