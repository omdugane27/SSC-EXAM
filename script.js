/* =========================================================
   SSC EXAMINATION SYSTEM
   Firebase + Firestore Exam Engine

   FEATURES
   - Scheduled exam start
   - Scheduled exam end
   - Manual submit
   - Automatic submit ONLY at scheduled end time
   - One-time exam attempt
   - Server/Firestore result record
   - Pending result
   - Back button protection
   - Refresh/close warning
   - Saved answers
   - Question palette
========================================================= */


/* =========================================================
   FIREBASE CONFIGURATION
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


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;
let candidateData = null;
let examData = null;

let questions = [];
let currentQuestion = 0;

let answers = {};
let markedQuestions = {};

let timerInterval = null;
let scheduleInterval = null;

let remainingSeconds = 0;

let examId = null;

let examSubmitting = false;

let examCompleted = false;

let examStarted = false;

let examStartTimestamp = null;
let examEndTimestamp = null;


/* =========================================================
   GET EXAM ID
========================================================= */

const urlParams =
    new URLSearchParams(
        window.location.search
    );

examId =
    urlParams.get("examId") ||
    sessionStorage.getItem("examId");


/* =========================================================
   DOM ELEMENTS
========================================================= */

const candidateNameElement =
    document.getElementById("candidateName");

const timerElement =
    document.getElementById("timer");

const questionNumberElement =
    document.getElementById("questionNumber");

const totalQuestionsElement =
    document.getElementById("totalQuestions");

const questionTextElement =
    document.getElementById("questionText");

const optionsElement =
    document.getElementById("options");

const questionPaletteElement =
    document.getElementById("questionPalette");


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        startExam();

    }
);


/* =========================================================
   WAIT FOR FIREBASE AUTH
========================================================= */

function waitForAuth() {

    return new Promise(
        function(resolve) {

            let finished = false;

            const unsubscribe =
                auth.onAuthStateChanged(
                    function(user) {

                        if (finished) {
                            return;
                        }

                        finished = true;

                        unsubscribe();

                        resolve(user);

                    }
                );

        }
    );

}


/* =========================================================
   START EXAM
========================================================= */

async function startExam() {

    try {

        /* ================================================
           CHECK EXAM ID
        ================================================= */

        if (!examId) {

            alert(
                "Exam ID not found."
            );

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        /* ================================================
           FIREBASE LOGIN
        ================================================= */

        currentUser =
            await waitForAuth();


        if (!currentUser) {

            alert(
                "Please login first."
            );

            window.location.replace(
                "login.html"
            );

            return;
        }


        /* ================================================
           LOAD CANDIDATE
        ================================================= */

        candidateData =
            await loadCandidate();


        if (!candidateData) {

            alert(
                "Candidate record could not be loaded."
            );

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        /* ================================================
           CANDIDATE NAME
        ================================================= */

        if (candidateNameElement) {

            candidateNameElement.textContent =
                candidateData.fullName ||
                candidateData.name ||
                currentUser.email ||
                "Candidate";

        }


        /* ================================================
           LOAD EXAM
        ================================================= */

        const examSnapshot =
            await db
            .collection("exams")
            .doc(examId)
            .get();


        if (!examSnapshot.exists) {

            alert(
                "Exam not found."
            );

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        examData =
            examSnapshot.data() || {};


        /* ================================================
           CHECK EXAM STATUS
        ================================================= */

        const status =
            String(
                examData.status || ""
            )
            .trim()
            .toLowerCase();


        if (
            status !== "published" &&
            status !== "active"
        ) {

            alert(
                "This examination is not currently active."
            );

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        /* ================================================
           CHECK ASSIGNMENT
        ================================================= */

        if (
            candidateData.assignedExamId &&
            String(
                candidateData.assignedExamId
            ) !== String(examId)
        ) {

            alert(
                "This examination is not assigned to you."
            );

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        /* ================================================
           CHECK EXAM SCHEDULE
        ================================================= */

        const schedule =
            getExamSchedule();


        if (!schedule.valid) {

            alert(
                "Exam date/time is not configured correctly.\n\n" +
                "Please contact the administrator."
            );

            console.error(
                "Invalid exam schedule:",
                schedule
            );

            return;
        }


        examStartTimestamp =
            schedule.start;


        examEndTimestamp =
            schedule.end;


        /* ================================================
           CHECK IF EXAM HAS NOT STARTED
        ================================================= */

        const now =
            Date.now();


        if (
            now <
            examStartTimestamp
        ) {

            showExamNotStarted(
                examStartTimestamp
            );

            startPreExamClock();

            return;

        }


        /* ================================================
           CHECK IF EXAM ALREADY ENDED
        ================================================= */

        if (
            now >=
            examEndTimestamp
        ) {

            showExamExpired();

            /*
             * Important:
             * Do NOT create a result here just because
             * the candidate opened the page.
             *
             * Auto-submit only applies after a real
             * started exam attempt exists.
             */

            return;

        }


        /* ================================================
           ONE-TIME ATTEMPT CHECK
        ================================================= */

        const alreadySubmitted =
            await hasAlreadySubmitted();


        if (alreadySubmitted) {

            alert(
                "You have already attempted this examination.\n\n" +
                "You cannot attempt the same examination again."
            );

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        /* ================================================
           START ACTUAL EXAM
        ================================================= */

        examStarted =
            true;


        /* ================================================
           LOAD QUESTIONS
        ================================================= */

        await loadQuestions();


        if (questions.length === 0) {

            alert(
                "No questions found for this examination."
            );

            return;
        }


        /* ================================================
           TOTAL QUESTIONS
        ================================================= */

        if (totalQuestionsElement) {

            totalQuestionsElement.textContent =
                questions.length;

        }


        /* ================================================
           LOAD SAVED ANSWERS
        ================================================= */

        loadSavedAnswers();


        /* ================================================
           CREATE QUESTION PALETTE
        ================================================= */

        createQuestionPalette();


        /* ================================================
           DISPLAY QUESTION
        ================================================= */

        displayQuestion();


        /* ================================================
           START SCHEDULED TIMER
        ================================================= */

        startTimer();


        /* ================================================
           ENABLE EXAM LOCK
        ================================================= */

        enableExamNavigationLock();


    } catch (error) {

        console.error(
            "EXAM START ERROR:",
            error
        );

        alert(
            "Unable to start examination.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   LOAD CANDIDATE
========================================================= */

async function loadCandidate() {

    let snapshot = null;


    /* UID DOCUMENT */

    try {

        const uidSnapshot =
            await db
            .collection("candidates")
            .doc(currentUser.uid)
            .get();


        if (uidSnapshot.exists) {

            snapshot =
                uidSnapshot;

        }

    } catch (error) {

        console.warn(
            "UID candidate lookup failed:",
            error
        );

    }


    /* STORED CANDIDATE DOC */

    if (!snapshot) {

        const storedDocId =
            sessionStorage.getItem(
                "candidateDocId"
            );


        if (storedDocId) {

            try {

                const storedSnapshot =
                    await db
                    .collection("candidates")
                    .doc(storedDocId)
                    .get();


                if (
                    storedSnapshot.exists
                ) {

                    snapshot =
                        storedSnapshot;

                }

            } catch (error) {

                console.warn(
                    "Stored candidate lookup failed:",
                    error
                );

            }

        }

    }


    /* EMAIL FALLBACK */

    if (
        !snapshot &&
        currentUser.email
    ) {

        try {

            const email =
                String(
                    currentUser.email
                )
                .trim()
                .toLowerCase();


            const result =
                await db
                .collection("candidates")
                .where(
                    "email",
                    "==",
                    email
                )
                .limit(1)
                .get();


            if (!result.empty) {

                snapshot =
                    result.docs[0];

            }

        } catch (error) {

            console.warn(
                "Email candidate lookup failed:",
                error
            );

        }

    }


    if (!snapshot) {

        return null;

    }


    sessionStorage.setItem(
        "candidateDocId",
        snapshot.id
    );


    sessionStorage.setItem(
        "candidateUID",
        currentUser.uid
    );


    return snapshot.data() || {};

}


/* =========================================================
   EXAM DATE/TIME HELPERS
========================================================= */

function convertDateValue(value) {

    if (!value) {
        return null;
    }


    /* Firestore Timestamp */

    if (
        typeof value.toDate ===
        "function"
    ) {

        const date =
            value.toDate();

        return date.getTime();

    }


    /* JavaScript Date */

    if (
        value instanceof Date
    ) {

        return value.getTime();

    }


    /* Number timestamp */

    if (
        typeof value === "number"
    ) {

        if (value < 10000000000) {

            return value * 1000;

        }

        return value;

    }


    /* String */

    const text =
        String(value).trim();


    if (!text) {
        return null;
    }


    /*
     * YYYY-MM-DD
     */

    const match =
        text.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );


    if (match) {

        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            0,
            0,
            0,
            0
        ).getTime();

    }


    const parsed =
        Date.parse(text);


    if (!Number.isNaN(parsed)) {

        return parsed;

    }


    return null;

}


/* =========================================================
   DATE ONLY TO YYYY-MM-DD
========================================================= */

function getDateString(value) {

    if (!value) {
        return null;
    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        const d =
            value.toDate();


        return [
            d.getFullYear(),
            String(
                d.getMonth() + 1
            ).padStart(2, "0"),
            String(
                d.getDate()
            ).padStart(2, "0")
        ].join("-");

    }


    if (
        value instanceof Date
    ) {

        return [
            value.getFullYear(),
            String(
                value.getMonth() + 1
            ).padStart(2, "0"),
            String(
                value.getDate()
            ).padStart(2, "0")
        ].join("-");

    }


    const text =
        String(value).trim();


    const match =
        text.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );


    if (match) {

        return (
            match[1] +
            "-" +
            match[2] +
            "-" +
            match[3]
        );

    }


    const parsed =
        Date.parse(text);


    if (!Number.isNaN(parsed)) {

        const d =
            new Date(parsed);


        return [
            d.getFullYear(),
            String(
                d.getMonth() + 1
            ).padStart(2, "0"),
            String(
                d.getDate()
            ).padStart(2, "0")
        ].join("-");

    }


    return null;

}


/* =========================================================
   TIME PARSER
========================================================= */

function parseTime(
    timeValue
) {

    if (!timeValue) {

        return {
            hours: 0,
            minutes: 0,
            seconds: 0
        };

    }


    const text =
        String(timeValue)
        .trim()
        .toUpperCase();


    /*
     * HH:MM
     * HH:MM:SS
     * HH:MM AM
     * HH:MM PM
     */

    const match =
        text.match(
            /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/
        );


    if (!match) {

        return null;

    }


    let hours =
        Number(match[1]);


    const minutes =
        Number(match[2]);


    const seconds =
        Number(
            match[3] || 0
        );


    const ampm =
        match[4];


    if (
        minutes > 59 ||
        seconds > 59
    ) {

        return null;

    }


    if (ampm === "PM" && hours < 12) {

        hours += 12;

    }


    if (ampm === "AM" && hours === 12) {

        hours = 0;

    }


    if (
        hours > 23
    ) {

        return null;

    }


    return {
        hours,
        minutes,
        seconds
    };

}


/* =========================================================
   BUILD DATE + TIME
========================================================= */

function combineDateAndTime(
    dateValue,
    timeValue
) {

    const dateString =
        getDateString(
            dateValue
        );


    if (!dateString) {

        return null;

    }


    const time =
        parseTime(
            timeValue
        );


    if (!time) {

        return null;

    }


    const parts =
        dateString.split("-");


    if (
        parts.length !== 3
    ) {

        return null;

    }


    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2]),
            time.hours,
            time.minutes,
            time.seconds,
            0
        );


    return date.getTime();

}


/* =========================================================
   GET EXAM SCHEDULE
========================================================= */

function getExamSchedule() {

    /*
     * Supported date fields:
     *
     * startDate
     * examStartDate
     * examDate
     * date
     *
     * endDate
     * examEndDate
     * examDate
     * date
     */

    const startDateValue =
        examData.startDate ||
        examData.examStartDate ||
        examData.examDate ||
        examData.date;


    const endDateValue =
        examData.endDate ||
        examData.examEndDate ||
        examData.examDate ||
        examData.date;


    /*
     * Supported time fields
     */

    const startTimeValue =
        examData.startTime ||
        examData.examStartTime ||
        examData.startAt;


    const endTimeValue =
        examData.endTime ||
        examData.examEndTime ||
        examData.endAt;


    let startTimestamp = null;

    let endTimestamp = null;


    /* ================================================
       START
    ================================================= */

    if (startDateValue) {

        if (startTimeValue) {

            startTimestamp =
                combineDateAndTime(
                    startDateValue,
                    startTimeValue
                );

        } else {

            startTimestamp =
                convertDateValue(
                    startDateValue
                );

        }

    }


    /* ================================================
       END
    ================================================= */

    if (endDateValue) {

        if (endTimeValue) {

            endTimestamp =
                combineDateAndTime(
                    endDateValue,
                    endTimeValue
                );

        } else {

            endTimestamp =
                convertDateValue(
                    endDateValue
                );

        }

    }


    /*
     * If no explicit start time but duration exists,
     * start at exam start date/time.
     */

    if (
        startTimestamp &&
        !endTimestamp
    ) {

        const durationMinutes =
            Number(
                examData.duration ||
                examData.durationMinutes ||
                0
            );


        if (
            durationMinutes > 0
        ) {

            endTimestamp =
                startTimestamp +
                (
                    durationMinutes *
                    60 *
                    1000
                );

        }

    }


    /*
     * If start is missing but end exists,
     * derive start from duration.
     */

    if (
        !startTimestamp &&
        endTimestamp
    ) {

        const durationMinutes =
            Number(
                examData.duration ||
                examData.durationMinutes ||
                0
            );


        if (
            durationMinutes > 0
        ) {

            startTimestamp =
                endTimestamp -
                (
                    durationMinutes *
                    60 *
                    1000
                );

        }

    }


    /*
     * Validate
     */

    if (
        !startTimestamp ||
        !endTimestamp
    ) {

        return {
            valid: false,
            start: null,
            end: null
        };

    }


    if (
        endTimestamp <=
        startTimestamp
    ) {

        return {
            valid: false,
            start: startTimestamp,
            end: endTimestamp
        };

    }


    return {
        valid: true,
        start: startTimestamp,
        end: endTimestamp
    };

}


/* =========================================================
   FORMAT DATE/TIME FOR USER
========================================================= */

function formatDateTime(
    timestamp
) {

    if (!timestamp) {

        return "-";

    }


    return new Date(
        timestamp
    ).toLocaleString(
        "en-IN",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );

}


/* =========================================================
   EXAM NOT STARTED
========================================================= */

function showExamNotStarted(
    startTimestamp
) {

    examStarted =
        false;


    if (timerElement) {

        timerElement.textContent =
            "--:--";

    }


    if (questionTextElement) {

        questionTextElement.innerHTML =
            "Examination has not started yet.";

    }


    if (optionsElement) {

        optionsElement.innerHTML = `

            <div style="
                width:100%;
                padding:30px 20px;
                text-align:center;
                background:#eff6ff;
                border:1px solid #bfdbfe;
                border-radius:10px;
                color:#1e40af;
                line-height:1.7;
            ">

                <div style="
                    font-size:40px;
                    margin-bottom:10px;
                ">
                    ⏰
                </div>

                <strong>
                    Exam Not Started
                </strong>

                <br>

                Start Time:
                ${formatDateTime(startTimestamp)}

            </div>

        `;

    }


    if (questionPaletteElement) {

        questionPaletteElement.innerHTML =
            "";

    }


    const submitButton =
        document.querySelector(
            ".submit-btn"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

    }


    startPreExamClock();

}


/* =========================================================
   PRE-EXAM CLOCK
========================================================= */

function startPreExamClock() {

    clearInterval(
        scheduleInterval
    );


    scheduleInterval =
        setInterval(
            function() {

                const now =
                    Date.now();


                if (
                    now >=
                    examStartTimestamp
                ) {

                    clearInterval(
                        scheduleInterval
                    );


                    /*
                     * Reload page so the complete exam
                     * initialization happens from the
                     * scheduled start.
                     */

                    window.location.reload();

                    return;

                }


                const seconds =
                    Math.max(
                        0,
                        Math.floor(
                            (
                                examStartTimestamp -
                                now
                            ) / 1000
                        )
                    );


                const minutes =
                    Math.floor(
                        seconds / 60
                    );


                const secs =
                    seconds % 60;


                if (timerElement) {

                    timerElement.textContent =
                        String(minutes)
                        .padStart(2, "0") +
                        ":" +
                        String(secs)
                        .padStart(2, "0");

                }

            },
            1000
        );

}


/* =========================================================
   EXAM EXPIRED BEFORE START
========================================================= */

function showExamExpired() {

    examStarted =
        false;


    if (timerElement) {

        timerElement.textContent =
            "00:00";

    }


    if (questionTextElement) {

        questionTextElement.innerHTML =
            "Examination time has ended.";

    }


    if (optionsElement) {

        optionsElement.innerHTML = `

            <div style="
                width:100%;
                padding:30px 20px;
                text-align:center;
                background:#fee2e2;
                border:1px solid #fecaca;
                border-radius:10px;
                color:#991b1b;
                line-height:1.7;
            ">

                <div style="
                    font-size:40px;
                    margin-bottom:10px;
                ">
                    ⏰
                </div>

                <strong>
                    Examination Closed
                </strong>

                <br>

                The scheduled examination time
                has ended.

            </div>

        `;

    }


    if (questionPaletteElement) {

        questionPaletteElement.innerHTML =
            "";

    }


    const submitButton =
        document.querySelector(
            ".submit-btn"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

    }


    setTimeout(
        function() {

            window.location.replace(
                "candidate_dashboard.html"
            );

        },
        3000
    );

}


/* =========================================================
   HAS ALREADY SUBMITTED
========================================================= */

async function hasAlreadySubmitted() {

    const candidateResults =
        await db
        .collection("examResults")
        .where(
            "candidateId",
            "==",
            currentUser.uid
        )
        .get();


    let submitted =
        false;


    candidateResults.forEach(
        function(doc) {

            const data =
                doc.data() || {};


            if (
                String(
                    data.examId
                ) ===
                String(examId)
            ) {

                const status =
                    String(
                        data.resultStatus ||
                        data.status ||
                        ""
                    )
                    .toLowerCase();


                /*
                 * Any existing result means
                 * this exam attempt is already used.
                 */

                if (
                    status === "pending" ||
                    status === "declared" ||
                    status === "submitted" ||
                    status === "completed" ||
                    status === ""
                ) {

                    submitted =
                        true;

                }

            }

        }
    );


    return submitted;

}


/* =========================================================
   LOAD QUESTIONS
========================================================= */

async function loadQuestions() {

    questions = [];

    try {

        const snapshot =
            await db
            .collection("questions")
            .where(
                "examId",
                "==",
                examId
            )
            .get();


        snapshot.forEach(
            function(doc) {

                const data =
                    doc.data() || {};


                questions.push({

                    id:
                        doc.id,

                    questionNumber:
                        data.questionNumber ||
                        questions.length + 1,

                    questionText:
                        data.questionText ||
                        data.question ||
                        data.text ||
                        "",

                    optionA:
                        data.optionA ||
                        (
                            data.options &&
                            data.options.A
                        ) ||
                        "",

                    optionB:
                        data.optionB ||
                        (
                            data.options &&
                            data.options.B
                        ) ||
                        "",

                    optionC:
                        data.optionC ||
                        (
                            data.options &&
                            data.options.C
                        ) ||
                        "",

                    optionD:
                        data.optionD ||
                        (
                            data.options &&
                            data.options.D
                        ) ||
                        "",

                    correctAnswer:
                        data.correctAnswer ||
                        "",

                    marks:
                        Number(
                            data.marks || 1
                        ),

                    topic:
                        data.topic || "",

                    difficulty:
                        data.difficulty || ""

                });

            }
        );


        questions.sort(
            function(a,b) {

                return (
                    Number(
                        a.questionNumber
                    ) -
                    Number(
                        b.questionNumber
                    )
                );

            }
        );


    } catch (error) {

        console.error(
            "QUESTION LOAD ERROR:",
            error
        );

        throw error;

    }

}


/* =========================================================
   DISPLAY QUESTION
========================================================= */

function displayQuestion() {

    if (
        questions.length === 0 ||
        currentQuestion < 0 ||
        currentQuestion >= questions.length
    ) {

        return;

    }


    const question =
        questions[currentQuestion];


    if (questionNumberElement) {

        questionNumberElement.textContent =
            currentQuestion + 1;

    }


    if (totalQuestionsElement) {

        totalQuestionsElement.textContent =
            questions.length;

    }


    if (questionTextElement) {

        questionTextElement.innerHTML =
            formatQuestion(
                question.questionText
            );

    }


    if (optionsElement) {

        optionsElement.innerHTML =
            "";


        const options = [

            {
                key: "A",
                text: question.optionA
            },

            {
                key: "B",
                text: question.optionB
            },

            {
                key: "C",
                text: question.optionC
            },

            {
                key: "D",
                text: question.optionD
            }

        ];


        options.forEach(
            function(option) {

                if (!option.text) {

                    return;

                }


                const label =
                    document.createElement(
                        "label"
                    );


                label.className =
                    "exam-option";


                const radio =
                    document.createElement(
                        "input"
                    );


                radio.type =
                    "radio";


                radio.name =
                    "question_" +
                    currentQuestion;


                radio.value =
                    option.key;


                if (
                    answers[currentQuestion] ===
                    option.key
                ) {

                    radio.checked =
                        true;

                }


                radio.addEventListener(
                    "change",
                    function() {

                        saveAnswer(
                            currentQuestion,
                            option.key
                        );

                    }
                );


                const optionText =
                    document.createElement(
                        "span"
                    );


                optionText.innerHTML =
                    "<strong>" +
                    option.key +
                    ".</strong> " +
                    formatQuestion(
                        option.text
                    );


                label.appendChild(
                    radio
                );


                label.appendChild(
                    optionText
                );


                optionsElement.appendChild(
                    label
                );

            }
        );

    }


    updateQuestionPalette();


    const previousButton =
        document.querySelector(
            'button[onclick="previousQuestion()"]'
        );


    if (previousButton) {

        previousButton.disabled =
            currentQuestion === 0;

    }


    const nextButton =
        document.querySelector(
            'button[onclick="nextQuestion()"]'
        );


    if (nextButton) {

        if (
            currentQuestion ===
            questions.length - 1
        ) {

            nextButton.textContent =
                "Save & Finish";

        } else {

            nextButton.textContent =
                "Save & Next";

        }

    }

}


/* =========================================================
   FORMAT QUESTION
========================================================= */

function formatQuestion(text) {

    if (!text) {

        return "";

    }


    return String(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /\n/g,
            "<br>"
        )
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

}


/* =========================================================
   SAVE ANSWER
========================================================= */

function saveAnswer(
    questionIndex,
    answer
) {

    if (
        !examStarted ||
        examCompleted
    ) {

        return;

    }


    answers[questionIndex] =
        answer;


    saveExamState();

    updateQuestionPalette();

}


/* =========================================================
   CLEAR ANSWER
========================================================= */

function clearAnswer() {

    if (
        !examStarted ||
        examCompleted
    ) {

        return;

    }


    delete answers[
        currentQuestion
    ];


    const radios =
        document.querySelectorAll(
            'input[name="question_' +
            currentQuestion +
            '"]'
        );


    radios.forEach(
        function(radio) {

            radio.checked =
                false;

        }
    );


    saveExamState();

    updateQuestionPalette();

}


/* =========================================================
   MARK FOR REVIEW
========================================================= */

function markReview() {

    if (
        !examStarted ||
        examCompleted
    ) {

        return;

    }


    if (
        markedQuestions[
            currentQuestion
        ]
    ) {

        delete markedQuestions[
            currentQuestion
        ];

    } else {

        markedQuestions[
            currentQuestion
        ] = true;

    }


    saveExamState();

    updateQuestionPalette();

}


/* =========================================================
   NEXT QUESTION
========================================================= */

function nextQuestion() {

    if (
        !examStarted ||
        examCompleted
    ) {

        return;

    }


    if (
        currentQuestion <
        questions.length - 1
    ) {

        currentQuestion++;

        displayQuestion();

        window.scrollTo(
            0,
            0
        );

    } else {

        const confirmFinish =
            confirm(
                "You are on the last question.\n\n" +
                "Do you want to submit the examination?"
            );


        if (confirmFinish) {

            submitExam();

        }

    }

}


/* =========================================================
   PREVIOUS QUESTION
========================================================= */

function previousQuestion() {

    if (
        !examStarted ||
        examCompleted
    ) {

        return;

    }


    if (
        currentQuestion > 0
    ) {

        currentQuestion--;

        displayQuestion();

        window.scrollTo(
            0,
            0
        );

    }

}


/* =========================================================
   CREATE QUESTION PALETTE
========================================================= */

function createQuestionPalette() {

    if (!questionPaletteElement) {

        return;

    }


    questionPaletteElement.innerHTML =
        "";


    questions.forEach(
        function(
            question,
            index
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.textContent =
                index + 1;


            button.className =
                "palette-question";


            button.addEventListener(
                "click",
                function() {

                    if (
                        !examStarted ||
                        examCompleted
                    ) {

                        return;

                    }


                    currentQuestion =
                        index;

                    displayQuestion();

                }
            );


            questionPaletteElement.appendChild(
                button
            );

        }
    );

}


/* =========================================================
   UPDATE QUESTION PALETTE
========================================================= */

function updateQuestionPalette() {

    if (!questionPaletteElement) {

        return;

    }


    const buttons =
        questionPaletteElement
        .querySelectorAll(
            ".palette-question"
        );


    buttons.forEach(
        function(
            button,
            index
        ) {

            button.classList.remove(
                "answered"
            );

            button.classList.remove(
                "marked"
            );

            button.classList.remove(
                "current"
            );


            if (answers[index]) {

                button.classList.add(
                    "answered"
                );

            }


            if (
                markedQuestions[index]
            ) {

                button.classList.add(
                    "marked"
                );

            }


            if (
                index ===
                currentQuestion
            ) {

                button.classList.add(
                    "current"
                );

            }

        }
    );

}


/* =========================================================
   START TIMER BASED ON ACTUAL EXAM END TIME
========================================================= */

function startTimer() {

    clearInterval(
        timerInterval
    );


    if (
        !examStartTimestamp ||
        !examEndTimestamp
    ) {

        console.error(
            "Exam schedule is missing."
        );

        return;

    }


    /*
     * IMPORTANT:
     *
     * Timer is calculated from Firebase exam
     * end date/time.
     *
     * It is NOT calculated from page opening.
     */

    remainingSeconds =
        Math.max(
            0,
            Math.floor(
                (
                    examEndTimestamp -
                    Date.now()
                ) / 1000
            )
        );


    updateTimerDisplay();


    if (
        remainingSeconds <= 0
    ) {

        autoSubmitByTime();

        return;

    }


    timerInterval =
        setInterval(
            function() {

                if (
                    examCompleted ||
                    examSubmitting
                ) {

                    clearInterval(
                        timerInterval
                    );

                    return;

                }


                const now =
                    Date.now();


                remainingSeconds =
                    Math.max(
                        0,
                        Math.floor(
                            (
                                examEndTimestamp -
                                now
                            ) / 1000
                        )
                    );


                updateTimerDisplay();


                if (
                    now >=
                    examEndTimestamp
                ) {

                    clearInterval(
                        timerInterval
                    );


                    autoSubmitByTime();

                }

            },
            1000
        );

}


/* =========================================================
   TIMER DISPLAY
========================================================= */

function updateTimerDisplay() {

    if (!timerElement) {

        return;

    }


    const minutes =
        Math.floor(
            remainingSeconds /
            60
        );


    const seconds =
        remainingSeconds %
        60;


    timerElement.textContent =
        String(minutes)
        .padStart(
            2,
            "0"
        ) +
        ":" +
        String(seconds)
        .padStart(
            2,
            "0"
        );


    if (
        remainingSeconds <=
        60
    ) {

        timerElement.style.background =
            "#dc2626";

        timerElement.style.color =
            "#ffffff";

    }

}


/* =========================================================
   AUTO SUBMIT BY SCHEDULED END TIME
========================================================= */

async function autoSubmitByTime() {

    if (
        !examStarted ||
        examCompleted ||
        examSubmitting
    ) {

        return;

    }


    /*
     * This is the ONLY automatic submit condition.
     *
     * Login does not submit.
     * Dashboard does not submit.
     * Opening exam does not submit.
     *
     * Only actual exam end time triggers it.
     */

    if (
        Date.now() <
        examEndTimestamp
    ) {

        return;

    }


    await submitExam(
        true
    );

}


/* =========================================================
   SAVE EXAM STATE
========================================================= */

function saveExamState() {

    try {

        sessionStorage.setItem(
            "examAnswers_" +
            examId,

            JSON.stringify(
                answers
            )
        );


        sessionStorage.setItem(
            "examMarked_" +
            examId,

            JSON.stringify(
                markedQuestions
            )
        );


    } catch (error) {

        console.error(
            "STATE SAVE ERROR:",
            error
        );

    }

}


/* =========================================================
   LOAD SAVED ANSWERS
========================================================= */

function loadSavedAnswers() {

    try {

        const savedAnswers =
            sessionStorage.getItem(
                "examAnswers_" +
                examId
            );


        const savedMarked =
            sessionStorage.getItem(
                "examMarked_" +
                examId
            );


        if (savedAnswers) {

            answers =
                JSON.parse(
                    savedAnswers
                );

        }


        if (savedMarked) {

            markedQuestions =
                JSON.parse(
                    savedMarked
                );

        }

    } catch (error) {

        console.error(
            "STATE RESTORE ERROR:",
            error
        );

        answers = {};

        markedQuestions = {};

    }

}


/* =========================================================
   SUBMIT EXAM
========================================================= */

async function submitExam(
    automatic = false
) {

    if (examSubmitting) {

        return;

    }


    if (
        examCompleted
    ) {

        return;

    }


    /*
     * Manual submit is allowed only while
     * exam is active.
     */

    if (
        !automatic &&
        (
            !examStarted ||
            Date.now() >=
            examEndTimestamp
        )
    ) {

        if (
            Date.now() >=
            examEndTimestamp
        ) {

            await autoSubmitByTime();

        }

        return;

    }


    /*
     * Automatic submit is allowed ONLY after
     * scheduled end time.
     */

    if (
        automatic &&
        Date.now() <
        examEndTimestamp
    ) {

        return;

    }


    examSubmitting =
        true;


    try {

        clearInterval(
            timerInterval
        );


        /* ================================================
           FINAL ONE-TIME CHECK
        ================================================= */

        const alreadySubmitted =
            await hasAlreadySubmitted();


        if (alreadySubmitted) {

            examSubmitting =
                false;


            examCompleted =
                true;


            window.location.replace(
                "candidate_dashboard.html"
            );


            return;

        }


        /* ================================================
           MANUAL CONFIRMATION
        ================================================= */

        if (!automatic) {

            const confirmSubmit =
                confirm(
                    "Are you sure you want to submit your examination?\n\n" +
                    "You will not be able to change your answers after submission."
                );


            if (!confirmSubmit) {

                examSubmitting =
                    false;


                startTimer();

                return;

            }

        }


        /* ================================================
           CALCULATE RESULT
        ================================================= */

        let attempted =
            0;

        let correct =
            0;

        let wrong =
            0;

        let totalMarks =
            0;

        let obtainedMarks =
            0;


        const submittedAnswers =
            [];


        questions.forEach(
            function(
                question,
                index
            ) {

                const selected =
                    answers[index] ||
                    "";


                const selectedAnswer =
                    String(
                        selected
                    )
                    .trim()
                    .toUpperCase();


                const correctAnswer =
                    String(
                        question.correctAnswer ||
                        ""
                    )
                    .trim()
                    .toUpperCase();


                const marks =
                    Number(
                        question.marks ||
                        1
                    );


                totalMarks +=
                    marks;


                if (
                    selectedAnswer
                ) {

                    attempted++;


                    if (
                        selectedAnswer ===
                        correctAnswer
                    ) {

                        correct++;

                        obtainedMarks +=
                            marks;

                    } else {

                        wrong++;

                    }

                }


                submittedAnswers.push({

                    questionId:
                        question.id,

                    questionNumber:
                        index + 1,

                    selectedAnswer:
                        selectedAnswer,

                    correctAnswer:
                        correctAnswer,

                    marks:
                        marks

                });

            }
        );


        const unanswered =
            questions.length -
            attempted;


        const percentage =
            totalMarks > 0
                ? (
                    obtainedMarks /
                    totalMarks
                ) * 100
                : 0;


        const passMarks =
            Number(
                examData.passMarks ||
                Math.ceil(
                    totalMarks *
                    0.40
                )
            );


        const finalResult =
            obtainedMarks >=
            passMarks
                ? "PASS"
                : "FAIL";


        /* ================================================
           RESULT DOCUMENT
        ================================================= */

        const resultData = {

            candidateId:
                currentUser.uid,

            candidateName:
                candidateData.fullName ||
                candidateData.name ||
                "",

            candidateEmail:
                candidateData.email ||
                currentUser.email ||
                "",

            rollNumber:
                candidateData.rollNumber ||
                "",

            examId:
                examId,

            examName:
                examData.examName ||
                examData.name ||
                "",

            subject:
                examData.subject ||
                "",

            totalQuestions:
                questions.length,

            attempted:
                attempted,

            unanswered:
                unanswered,

            correct:
                correct,

            wrong:
                wrong,

            totalMarks:
                totalMarks,

            obtainedMarks:
                obtainedMarks,

            percentage:
                Number(
                    percentage.toFixed(
                        2
                    )
                ),

            passMarks:
                passMarks,

            result:
                finalResult,

            resultStatus:
                "pending",

            answers:
                submittedAnswers,

            submittedAutomatically:
                automatic,

            submittedReason:
                automatic
                    ? "Exam end date/time reached"
                    : "Candidate manually submitted",

            submittedAt:
                firebase.firestore
                .FieldValue
                .serverTimestamp(),

            declaredAt:
                null,

            declaredBy:
                null

        };


        /* ================================================
           SAVE RESULT
        ================================================= */

        const resultRef =
            await db
            .collection(
                "examResults"
            )
            .add(
                resultData
            );


        /* ================================================
           UPDATE CANDIDATE
        ================================================= */

        await db
            .collection(
                "candidates"
            )
            .doc(
                currentUser.uid
            )
            .set({

                examStatus:
                    "completed",

                lastExamId:
                    examId,

                lastResultId:
                    resultRef.id,

                resultStatus:
                    "pending",

                examSubmittedAt:
                    firebase.firestore
                    .FieldValue
                    .serverTimestamp()

            }, {

                merge:
                    true

            });


        /* ================================================
           MARK COMPLETED
        ================================================= */

        examCompleted =
            true;

        examStarted =
            false;


        /* ================================================
           CLEAR TIMER
        ================================================= */

        clearInterval(
            timerInterval
        );


        clearInterval(
            scheduleInterval
        );


        /* ================================================
           CLEAR SAVED ANSWERS
        ================================================= */

        sessionStorage.removeItem(
            "examAnswers_" +
            examId
        );


        sessionStorage.removeItem(
            "examMarked_" +
            examId
        );


        sessionStorage.removeItem(
            "examEndTime_" +
            examId
        );


        sessionStorage.setItem(
            "lastResultId",
            resultRef.id
        );


        /* ================================================
           SUCCESS
        ================================================= */

        showSuccessPopup(
            automatic
        );


    } catch (error) {

        console.error(
            "SUBMIT ERROR:",
            error
        );


        examSubmitting =
            false;


        alert(
            "Unable to submit examination.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   SUCCESS POPUP
========================================================= */

function showSuccessPopup(
    automatic
) {

    const oldPopup =
        document.getElementById(
            "examSuccessPopup"
        );


    if (oldPopup) {

        oldPopup.remove();

    }


    const popup =
        document.createElement(
            "div"
        );


    popup.id =
        "examSuccessPopup";


    const title =
        automatic
            ? "Examination Time Completed"
            : "Exam Submitted Successfully";


    const message =
        automatic
            ? "The scheduled examination end time has been reached. Your examination has been submitted automatically."
            : "Your examination has been submitted successfully.";


    popup.innerHTML = `

        <div style="
            position:fixed;
            inset:0;
            z-index:99999;
            background:rgba(0,0,0,.75);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        ">

            <div style="
                width:100%;
                max-width:430px;
                background:#ffffff;
                border-radius:20px;
                padding:32px 24px;
                text-align:center;
                box-shadow:
                    0 25px 70px
                    rgba(0,0,0,.35);
            ">

                <div style="
                    width:72px;
                    height:72px;
                    margin:0 auto 18px;
                    border-radius:50%;
                    background:#dcfce7;
                    color:#16a34a;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:40px;
                    font-weight:bold;
                ">
                    ✓
                </div>


                <h2 style="
                    margin:0 0 10px;
                    color:#172033;
                    font-size:23px;
                ">
                    ${title}
                </h2>


                <p style="
                    color:#64748b;
                    line-height:1.6;
                    margin:0 0 16px;
                    font-size:14px;
                ">
                    ${message}
                </p>


                <div style="
                    background:#fff7ed;
                    color:#9a3412;
                    padding:13px;
                    border-radius:10px;
                    font-size:13px;
                    line-height:1.5;
                    margin-bottom:22px;
                ">

                    <strong>
                        Result Pending
                    </strong>

                    <br>

                    Your result will be available
                    after the administrator officially
                    declares it.

                </div>


                <button
                    id="backToDashboardButton"
                    style="
                        width:100%;
                        padding:14px;
                        border:0;
                        border-radius:10px;
                        background:#123b72;
                        color:#ffffff;
                        font-size:15px;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    Go to Candidate Dashboard
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        popup
    );


    const button =
        document.getElementById(
            "backToDashboardButton"
        );


    if (button) {

        button.addEventListener(
            "click",
            function() {

                window.location.replace(
                    "candidate_dashboard.html"
                );

            }
        );

    }

}


/* =========================================================
   EXAM NAVIGATION LOCK
========================================================= */

function enableExamNavigationLock() {

    if (
        examCompleted ||
        !examStarted
    ) {

        return;

    }


    history.pushState(
        {
            examLocked: true
        },
        "",
        window.location.href
    );


    window.addEventListener(
        "popstate",
        function() {

            if (
                examCompleted ||
                !examStarted
            ) {

                return;

            }


            history.pushState(
                {
                    examLocked: true
                },
                "",
                window.location.href
            );


            showExitWarning();

        }
    );


    window.addEventListener(
        "beforeunload",
        function(event) {

            if (
                examCompleted ||
                !examStarted
            ) {

                return;

            }


            event.preventDefault();


            event.returnValue =
                "Your examination is still in progress. Please submit the examination before leaving.";


            return event.returnValue;

        }
    );


    document.addEventListener(
        "keydown",
        function(event) {

            if (
                examCompleted ||
                !examStarted
            ) {

                return;

            }


            if (
                event.altKey &&
                event.key === "ArrowLeft"
            ) {

                event.preventDefault();

                showExitWarning();

            }


            if (
                event.altKey &&
                event.key === "ArrowRight"
            ) {

                event.preventDefault();

            }


            if (
                event.key === "Backspace"
            ) {

                const tagName =
                    document.activeElement &&
                    document.activeElement.tagName
                        ?
                        document.activeElement.tagName
                        :
                        "";


                if (
                    tagName !== "INPUT" &&
                    tagName !== "TEXTAREA" &&
                    tagName !== "SELECT"
                ) {

                    event.preventDefault();

                    showExitWarning();

                }

            }

        }
    );

}


/* =========================================================
   EXIT WARNING
========================================================= */

function showExitWarning() {

    const existing =
        document.getElementById(
            "examExitWarning"
        );


    if (existing) {

        return;

    }


    const warning =
        document.createElement(
            "div"
        );


    warning.id =
        "examExitWarning";


    warning.innerHTML = `

        <div style="
            position:fixed;
            inset:0;
            z-index:100000;
            background:rgba(0,0,0,.78);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        ">

            <div style="
                width:100%;
                max-width:410px;
                background:#ffffff;
                border-radius:18px;
                padding:28px 22px;
                text-align:center;
                box-shadow:
                    0 25px 70px
                    rgba(0,0,0,.4);
            ">

                <div style="
                    font-size:46px;
                    margin-bottom:12px;
                ">
                    ⚠️
                </div>


                <h2 style="
                    margin:0 0 10px;
                    color:#172033;
                ">
                    Examination In Progress
                </h2>


                <p style="
                    color:#64748b;
                    line-height:1.6;
                    margin:0 0 22px;
                    font-size:14px;
                ">

                    You cannot leave the examination
                    before submitting it.

                    <br><br>

                    Please complete and submit your
                    examination.

                </p>


                <button
                    id="continueExamButton"
                    style="
                        width:100%;
                        padding:14px;
                        border:0;
                        border-radius:10px;
                        background:#123b72;
                        color:#ffffff;
                        font-size:15px;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    Continue Examination
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        warning
    );


    const continueButton =
        document.getElementById(
            "continueExamButton"
        );


    if (continueButton) {

        continueButton.addEventListener(
            "click",
            function() {

                warning.remove();

            }
        );

    }

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "pagehide",
    function() {

        clearInterval(
            timerInterval
        );

        clearInterval(
            scheduleInterval
        );

    }
);