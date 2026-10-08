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


/* =========================================
   AUTOMATIC ALLOCATION CONFIGURATION
========================================= */

const TOTAL_CENTRES = 3;
const LABS_PER_CENTRE = 5;
const SEATS_PER_LAB = 30;

const TOTAL_CAPACITY =
    TOTAL_CENTRES *
    LABS_PER_CENTRE *
    SEATS_PER_LAB;


/* =========================================
   VARIABLES
========================================= */

let currentAdmin = null;
let activeExam = null;
let selectedCandidate = null;


/* =========================================
   DOM
========================================= */

const messageBox =
    document.getElementById("message");

const candidateSearch =
    document.getElementById("candidateSearch");

const searchButton =
    document.getElementById("searchButton");

const assignButton =
    document.getElementById("assignButton");

const candidateSection =
    document.getElementById("candidateSection");

const allocationSection =
    document.getElementById("allocationSection");

const assignedSection =
    document.getElementById("assignedSection");


/* =========================================
   MESSAGE
========================================= */

function showMessage(text, type) {

    messageBox.textContent = text;

    messageBox.className = "message";

    if (type === "success") {
        messageBox.classList.add("success");
    } else {
        messageBox.classList.add("error");
    }

    messageBox.style.display = "block";
}


function hideMessage() {

    messageBox.style.display = "none";
}


/* =========================================
   AUTHENTICATION
========================================= */

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        window.location.href =
            "admin-login.html";

        return;
    }


    try {

        const adminDoc = await db
            .collection("admins")
            .doc(user.uid)
            .get();


        if (!adminDoc.exists) {

            window.location.href =
                "admin-login.html";

            return;
        }


        const adminData =
            adminDoc.data();


        const role =
            String(
                adminData.role || ""
            ).toLowerCase();


        const status =
            String(
                adminData.status || ""
            ).toLowerCase();


        if (
            role !== "admin" ||
            status !== "active"
        ) {

            window.location.href =
                "admin-login.html";

            return;
        }


        currentAdmin = user;


        document.getElementById(
            "totalCentres"
        ).textContent =
            TOTAL_CENTRES;


        document.getElementById(
            "labsPerCentre"
        ).textContent =
            LABS_PER_CENTRE;


        document.getElementById(
            "seatsPerLab"
        ).textContent =
            SEATS_PER_LAB;


        document.getElementById(
            "totalCapacity"
        ).textContent =
            TOTAL_CAPACITY +
            " Candidates";


        await loadActiveExam();

    } catch (error) {

        console.error(error);

        showMessage(
            "Unable to verify administrator access.",
            "error"
        );
    }

});


/* =========================================
   LOAD ACTIVE EXAM
========================================= */

async function loadActiveExam() {

    const examLoading =
        document.getElementById(
            "examLoading"
        );

    const examDetails =
        document.getElementById(
            "examDetails"
        );

    const noExam =
        document.getElementById(
            "noExam"
        );


    try {

        const snapshot =
            await db
                .collection("exams")
                .where(
                    "status",
                    "==",
                    "active"
                )
                .limit(1)
                .get();


        if (snapshot.empty) {

            activeExam = null;

            examLoading.classList.add(
                "hidden"
            );

            noExam.classList.remove(
                "hidden"
            );

            return;
        }


        const doc =
            snapshot.docs[0];


        activeExam = {
            id: doc.id,
            ...doc.data()
        };


        document.getElementById(
            "examName"
        ).textContent =
            activeExam.examName || "-";


        document.getElementById(
            "examCode"
        ).textContent =
            activeExam.examCode || "-";


        document.getElementById(
            "examDate"
        ).textContent =
            activeExam.examDate || "-";


        document.getElementById(
            "examTime"
        ).textContent =
            activeExam.examTime || "-";


        document.getElementById(
            "examDuration"
        ).textContent =
            (activeExam.duration || 0) +
            " Minutes";


        document.getElementById(
            "examQuestions"
        ).textContent =
            activeExam.totalQuestions || 0;


        examLoading.classList.add(
            "hidden"
        );

        examDetails.classList.remove(
            "hidden"
        );


    } catch (error) {

        console.error(error);

        showMessage(
            "Unable to load active examination.",
            "error"
        );
    }
}


/* =========================================
   SEARCH CANDIDATE
========================================= */

searchButton.addEventListener(
    "click",
    searchCandidate
);


candidateSearch.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            searchCandidate();
        }

    }
);


async function searchCandidate() {

    hideMessage();


    const value =
        candidateSearch.value
            .trim()
            .toLowerCase();


    if (!value) {

        showMessage(
            "Enter candidate email or UID.",
            "error"
        );

        return;
    }


    searchButton.disabled = true;

    searchButton.textContent =
        "Searching...";


    candidateSection.classList.add(
        "hidden"
    );

    allocationSection.classList.add(
        "hidden"
    );

    assignedSection.classList.add(
        "hidden"
    );


    selectedCandidate = null;


    try {

        let candidateDoc = null;


        /* Search by UID */

        const uidDoc =
            await db
                .collection("candidates")
                .doc(value)
                .get();


        if (uidDoc.exists) {

            candidateDoc = uidDoc;

        } else {

            /* Search by email */

            const result =
                await db
                    .collection("candidates")
                    .where(
                        "email",
                        "==",
                        value
                    )
                    .limit(1)
                    .get();


            if (!result.empty) {

                candidateDoc =
                    result.docs[0];
            }
        }


        if (!candidateDoc) {

            showMessage(
                "Candidate not found.",
                "error"
            );

            return;
        }


        selectedCandidate = {

            id: candidateDoc.id,

            ...candidateDoc.data()

        };


        displayCandidate();


    } catch (error) {

        console.error(error);

        showMessage(
            "Unable to search candidate.",
            "error"
        );

    } finally {

        searchButton.disabled = false;

        searchButton.textContent =
            "Search";
    }
}


/* =========================================
   DISPLAY CANDIDATE
========================================= */

function displayCandidate() {

    document.getElementById(
        "candidateName"
    ).textContent =
        selectedCandidate.fullName || "-";


    document.getElementById(
        "candidateEmail"
    ).textContent =
        selectedCandidate.email || "-";


    document.getElementById(
        "candidateMobile"
    ).textContent =
        selectedCandidate.mobile || "-";


    document.getElementById(
        "candidateDob"
    ).textContent =
        selectedCandidate.dateOfBirth || "-";


    document.getElementById(
        "candidateUid"
    ).textContent =
        selectedCandidate.uid ||
        selectedCandidate.id;


    document.getElementById(
        "candidateStatus"
    ).textContent =
        selectedCandidate.status || "-";


    candidateSection.classList.remove(
        "hidden"
    );


    /*
     * Check whether candidate is
     * already assigned to the active exam.
     */

    if (
        selectedCandidate.assignedExamId ===
            activeExam?.id &&
        selectedCandidate.assignmentStatus ===
            "assigned"
    ) {

        displayExistingAssignment();

    } else {

        allocationSection.classList.remove(
            "hidden"
        );
    }
}


/* =========================================
   GENERATE CENTRE
========================================= */

function generateCentre(
    globalSeatNumber
) {

    const centreNumber =
        Math.floor(
            (globalSeatNumber - 1) /
            (LABS_PER_CENTRE *
             SEATS_PER_LAB)
        ) + 1;


    return {
        id:
            "CENTRE-" +
            String(
                centreNumber
            ).padStart(2, "0"),

        name:
            "Examination Centre " +
            String(
                centreNumber
            ).padStart(2, "0"),

        code:
            "CENTRE" +
            String(
                centreNumber
            ).padStart(2, "0")
    };
}


/* =========================================
   GENERATE LAB
========================================= */

function generateLab(
    globalSeatNumber
) {

    const centrePosition =
        (globalSeatNumber - 1) %
        (LABS_PER_CENTRE *
         SEATS_PER_LAB);


    const labNumber =
        Math.floor(
            centrePosition /
            SEATS_PER_LAB
        ) + 1;


    return {

        id:
            "LAB-" +
            String(
                labNumber
            ).padStart(2, "0"),

        name:
            "Computer Lab " +
            String(
                labNumber
            ).padStart(2, "0")
    };
}


/* =========================================
   GENERATE SEAT
========================================= */

function generateSeat(
    globalSeatNumber
) {

    const seatNumber =
        ((globalSeatNumber - 1) %
        SEATS_PER_LAB) + 1;


    return String(
        seatNumber
    ).padStart(3, "0");
}


/* =========================================
   GENERATE ROLL NUMBER
========================================= */

function generateRollNumber(
    exam,
    sequence
) {

    const examCode =
        String(
            exam.examCode ||
            "SSC"
        )
        .toUpperCase()
        .replace(
            /[^A-Z0-9]/g,
            ""
        )
        .substring(
            0,
            6
        );


    const year =
        exam.examDate
            ? new Date(
                exam.examDate
              ).getFullYear()
            : new Date()
                .getFullYear();


    const yearCode =
        String(year).slice(-2);


    const number =
        String(sequence)
            .padStart(4, "0");


    return (
        examCode +
        yearCode +
        number
    );
}


/* =========================================
   GET UNIQUE SEQUENCE
========================================= */

async function getNextSequence() {

    if (!activeExam) {
        throw new Error(
            "No active examination found."
        );
    }


    const sequenceRef =
        db.collection(
            "examSequences"
        ).doc(
            activeExam.id
        );


    let sequenceNumber = 0;


    await db.runTransaction(
        async (transaction) => {

            const sequenceDoc =
                await transaction.get(
                    sequenceRef
                );


            let nextNumber = 1;


            if (sequenceDoc.exists) {

                nextNumber =
                    Number(
                        sequenceDoc.data()
                            .nextNumber || 1
                    );
            }


            if (
                nextNumber >
                TOTAL_CAPACITY
            ) {

                throw new Error(
                    "All examination seats are currently allocated."
                );
            }


            sequenceNumber =
                nextNumber;


            transaction.set(
                sequenceRef,
                {

                    examId:
                        activeExam.id,

                    nextNumber:
                        nextNumber + 1,

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()

                },
                {
                    merge: true
                }
            );

        }
    );


    return sequenceNumber;
}


/* =========================================
   ASSIGN CANDIDATE
========================================= */

assignButton.addEventListener(
    "click",
    assignCandidate
);


async function assignCandidate() {

    hideMessage();


    if (!currentAdmin) {

        showMessage(
            "Administrator authentication is required.",
            "error"
        );

        return;
    }


    if (!activeExam) {

        showMessage(
            "No active examination found.",
            "error"
        );

        return;
    }


    if (!selectedCandidate) {

        showMessage(
            "Select a candidate first.",
            "error"
        );

        return;
    }


    assignButton.disabled = true;

    assignButton.textContent =
        "Generating Allocation...";


    try {

        /*
         * Re-read candidate before
         * assigning.
         */

        const candidateRef =
            db.collection(
                "candidates"
            ).doc(
                selectedCandidate.id
            );


        const latestDoc =
            await candidateRef.get();


        if (!latestDoc.exists) {

            throw new Error(
                "Candidate record was not found."
            );
        }


        const latestData =
            latestDoc.data();


        /*
         * Prevent duplicate assignment.
         */

        if (
            latestData.assignedExamId ===
                activeExam.id &&
            latestData.assignmentStatus ===
                "assigned"
        ) {

            selectedCandidate = {

                id: latestDoc.id,

                ...latestData

            };


            displayExistingAssignment();


            showMessage(
                "This candidate is already assigned to this examination.",
                "error"
            );


            return;
        }


        /*
         * Get unique sequence.
         */

        const sequence =
            await getNextSequence();


        /*
         * Generate automatic allocation.
         */

        const rollNumber =
            generateRollNumber(
                activeExam,
                sequence
            );


        const centre =
            generateCentre(
                sequence
            );


        const lab =
            generateLab(
                sequence
            );


        const seat =
            generateSeat(
                sequence
            );


        /*
         * Update candidate.
         */

        await candidateRef.update({

            assignedExamId:
                activeExam.id,

            assignedExamName:
                activeExam.examName || "",

            examCode:
                activeExam.examCode || "",

            rollNumber:
                rollNumber,

            centreId:
                centre.id,

            centreName:
                centre.name,

            centreCode:
                centre.code,

            roomId:
                lab.id,

            roomName:
                lab.name,

            seatNumber:
                seat,

            assignmentStatus:
                "assigned",

            assignedAt:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            assignedBy:
                currentAdmin.uid

        });


        /*
         * Update local object.
         */

        selectedCandidate = {

            ...selectedCandidate,

            assignedExamId:
                activeExam.id,

            assignedExamName:
                activeExam.examName,

            examCode:
                activeExam.examCode,

            rollNumber:
                rollNumber,

            centreId:
                centre.id,

            centreName:
                centre.name,

            centreCode:
                centre.code,

            roomId:
                lab.id,

            roomName:
                lab.name,

            seatNumber:
                seat,

            assignmentStatus:
                "assigned"

        };


        /*
         * Show final allocation.
         */

        displayExistingAssignment();


        showMessage(
            "Candidate assigned successfully. Roll number, centre, lab and seat number were generated automatically.",
            "success"
        );


    } catch (error) {

        console.error(
            "Assignment error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to assign candidate.",
            "error"
        );


    } finally {

        assignButton.disabled = false;

        assignButton.textContent =
            "Assign Examination & Generate Allocation";
    }
}


/* =========================================
   DISPLAY EXISTING ASSIGNMENT
========================================= */

function displayExistingAssignment() {

    allocationSection.classList.add(
        "hidden"
    );


    document.getElementById(
        "existingRollNumber"
    ).textContent =
        selectedCandidate.rollNumber || "-";


    document.getElementById(
        "existingExam"
    ).textContent =
        selectedCandidate.assignedExamName ||
        selectedCandidate.exam ||
        "-";


    document.getElementById(
        "existingCentre"
    ).textContent =
        selectedCandidate.centreName || "-";


    document.getElementById(
        "existingRoom"
    ).textContent =
        selectedCandidate.roomName || "-";


    document.getElementById(
        "existingSeat"
    ).textContent =
        selectedCandidate.seatNumber || "-";


    assignedSection.classList.remove(
        "hidden"
    );
}