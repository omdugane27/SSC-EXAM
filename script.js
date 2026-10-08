/* =========================================================
   SSC EXAMINATION SYSTEM
   Firebase + Firestore Exam Engine
========================================================= */


/* =========================
   FIREBASE CONFIG
========================= */

const firebaseConfig = {
    apiKey: "AIzaSyCuYIuB_I9OrrTx6Qox6GnUerkN_vDgIHI",
    authDomain: "ssc-exam-project-8af6b.firebaseapp.com",
    projectId: "ssc-exam-project-8af6b",
    storageBucket: "ssc-exam-project-8af6b.firebasestorage.app",
    messagingSenderId: "288245274853",
    appId: "1:288245274853:web:b4d535a08faf305f5e9c0c",
    measurementId: "G-4BTLY67VDS"
};


/* =========================
   INITIALIZE FIREBASE
========================= */

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();


/* =========================
   GLOBAL VARIABLES
========================= */

let currentUser = null;
let candidateData = null;
let examData = null;

let questions = [];
let currentQuestion = 0;

let answers = {};
let markedQuestions = {};

let timerInterval = null;
let remainingSeconds = 0;

let examId = null;


/* =========================
   GET EXAM ID
========================= */

const urlParams = new URLSearchParams(window.location.search);

examId =
    urlParams.get("examId") ||
    sessionStorage.getItem("examId");


/* =========================
   DOM ELEMENTS
========================= */

const candidateNameElement =
    document.getElementById("candidateName");

const timerElement =
    document.getElementById("timer");

const questionNumberElement =
    document.getElementById("questionNumber");

const questionTextElement =
    document.getElementById("questionText");

const optionsElement =
    document.getElementById("options");

const questionPaletteElement =
    document.getElementById("questionPalette");


/* =========================
   PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", function () {

    startExam();

});


/* =========================================================
   START EXAM
========================================================= */

async function startExam() {

    try {

        if (!examId) {

            alert("Exam ID not found.");

            window.location.replace(
                "candidate_dashboard.html"
            );

            return;
        }


        /* Check Firebase login */

        currentUser = await new Promise(function(resolve) {

            const unsubscribe =
                auth.onAuthStateChanged(function(user) {

                    unsubscribe();

                    resolve(user);

                });

        });


        if (!currentUser) {

            alert("Please login first.");

            window.location.replace(
                "login.html"
            );

            return;
        }


        /* Load candidate */

        const candidateSnapshot =
            await db
            .collection("candidates")
            .doc(currentUser.uid)
            .get();


        if (!candidateSnapshot.exists) {

            alert("Candidate record not found.");

            return;
        }


        candidateData =
            candidateSnapshot.data();


        /* Display candidate name */

        if (candidateNameElement) {

            candidateNameElement.textContent =
                candidateData.fullName ||
                candidateData.name ||
                currentUser.email ||
                "Candidate";

        }


        /* Load exam */

        const examSnapshot =
            await db
            .collection("exams")
            .doc(examId)
            .get();


        if (!examSnapshot.exists) {

            alert("Exam not found.");

            return;
        }


        examData =
            examSnapshot.data();


        /* Check exam status */

        const status =
            String(examData.status || "")
            .toLowerCase();


        if (
            status !== "published" &&
            status !== "active"
        ) {

            alert(
                "This examination is not currently active."
            );

            return;
        }


        /* Check assignment */

        if (
            candidateData.assignedExamId &&
            candidateData.assignedExamId !== examId
        ) {

            alert(
                "This examination is not assigned to you."
            );

            return;
        }


        /* Load questions */

        await loadQuestions();


        if (questions.length === 0) {

            alert(
                "No questions found for this examination."
            );

            return;
        }


        /* Restore saved answers */

        loadSavedAnswers();


        /* Create question palette */

        createQuestionPalette();


        /* Display first question */

        displayQuestion();


        /* Start timer */

        startTimer();


    } catch (error) {

        console.error(
            "Exam start error:",
            error
        );

        alert(
            "Unable to start examination.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   LOAD QUESTIONS
========================================================= */

async function loadQuestions() {

    questions = [];


    /*
       Main collection:
       questions
    */

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


        snapshot.forEach(function(doc) {

            const data = doc.data();

            questions.push({

                id: doc.id,

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
                    data.options?.A ||
                    "",

                optionB:
                    data.optionB ||
                    data.options?.B ||
                    "",

                optionC:
                    data.optionC ||
                    data.options?.C ||
                    "",

                optionD:
                    data.optionD ||
                    data.options?.D ||
                    "",

                correctAnswer:
                    data.correctAnswer ||
                    "",

                marks:
                    Number(data.marks || 1),

                topic:
                    data.topic ||
                    "",

                difficulty:
                    data.difficulty ||
                    ""

            });

        });

    } catch (error) {

        console.error(
            "Question query error:",
            error
        );

    }


    /*
       Sort questions by question number
    */

    questions.sort(function(a, b) {

        return (
            Number(a.questionNumber) -
            Number(b.questionNumber)
        );

    });

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


    /* Question number */

    if (questionNumberElement) {

        questionNumberElement.textContent =
            currentQuestion + 1;

    }


    /* Question text */

    if (questionTextElement) {

        questionTextElement.innerHTML =
            formatQuestion(
                question.questionText
            );

    }


    /* Options */

    if (optionsElement) {

        optionsElement.innerHTML = "";


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


        options.forEach(function(option) {

            if (!option.text) {
                return;
            }


            const label =
                document.createElement("label");

            label.className =
                "exam-option";


            const radio =
                document.createElement("input");

            radio.type = "radio";

            radio.name =
                "question_" +
                currentQuestion;

            radio.value =
                option.key;


            if (
                answers[currentQuestion] ===
                option.key
            ) {

                radio.checked = true;

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
                document.createElement("span");

            optionText.innerHTML =
                "<strong>" +
                option.key +
                ".</strong> " +
                formatQuestion(
                    option.text
                );


            label.appendChild(radio);

            label.appendChild(optionText);

            optionsElement.appendChild(label);

        });

    }


    /* Update palette */

    updateQuestionPalette();


    /* Previous button */

    const previousButton =
        document.querySelector(
            'button[onclick="previousQuestion()"]'
        );

    if (previousButton) {

        previousButton.disabled =
            currentQuestion === 0;

    }


    /* Last question button */

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
        .replace(/\n/g, "<br>")
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

    answers[questionIndex] =
        answer;


    saveExamState();


    updateQuestionPalette();

}


/* =========================================================
   CLEAR ANSWER
========================================================= */

function clearAnswer() {

    delete answers[currentQuestion];


    const radios =
        document.querySelectorAll(
            'input[name="question_' +
            currentQuestion +
            '"]'
        );


    radios.forEach(function(radio) {

        radio.checked = false;

    });


    saveExamState();

    updateQuestionPalette();

}


/* =========================================================
   MARK FOR REVIEW
========================================================= */

function markReview() {

    if (
        markedQuestions[currentQuestion]
    ) {

        delete markedQuestions[currentQuestion];

    } else {

        markedQuestions[currentQuestion] =
            true;

    }


    saveExamState();

    updateQuestionPalette();

}


/* =========================================================
   NEXT QUESTION
========================================================= */

function nextQuestion() {

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

    if (currentQuestion > 0) {

        currentQuestion--;

        displayQuestion();

        window.scrollTo(
            0,
            0
        );

    }

}


/* =========================================================
   QUESTION PALETTE
========================================================= */

function createQuestionPalette() {

    if (!questionPaletteElement) {
        return;
    }


    questionPaletteElement.innerHTML = "";


    questions.forEach(function(
        question,
        index
    ) {

        const button =
            document.createElement("button");


        button.type =
            "button";


        button.textContent =
            index + 1;


        button.className =
            "palette-question";


        button.addEventListener(
            "click",
            function() {

                currentQuestion =
                    index;

                displayQuestion();

            }
        );


        questionPaletteElement.appendChild(
            button
        );

    });

}


/* =========================================================
   UPDATE PALETTE
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


    buttons.forEach(function(
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


        if (
            answers[index]
        ) {

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
            index === currentQuestion
        ) {

            button.classList.add(
                "current"
            );

        }

    });

}


/* =========================================================
   TIMER
========================================================= */

function startTimer() {

    clearInterval(
        timerInterval
    );


    let durationMinutes =
        Number(
            examData.duration
        );


    if (
        !durationMinutes ||
        durationMinutes <= 0
    ) {

        durationMinutes = 60;

    }


    remainingSeconds =
        durationMinutes * 60;


    /*
       Restore timer if available
    */

    const savedEndTime =
        sessionStorage.getItem(
            "examEndTime_" + examId
        );


    if (savedEndTime) {

        remainingSeconds =
            Math.max(
                0,
                Math.floor(
                    (
                        Number(savedEndTime) -
                        Date.now()
                    ) / 1000
                )
            );

    } else {

        sessionStorage.setItem(
            "examEndTime_" + examId,
            (
                Date.now() +
                remainingSeconds * 1000
            ).toString()
        );

    }


    updateTimerDisplay();


    timerInterval =
        setInterval(
            function() {

                remainingSeconds--;

                updateTimerDisplay();


                if (
                    remainingSeconds <= 0
                ) {

                    clearInterval(
                        timerInterval
                    );

                    alert(
                        "Time is over. Your examination will be submitted automatically."
                    );

                    submitExam(
                        true
                    );

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
            remainingSeconds / 60
        );


    const seconds =
        remainingSeconds % 60;


    timerElement.textContent =
        String(minutes).padStart(
            2,
            "0"
        ) +
        ":" +
        String(seconds).padStart(
            2,
            "0"
        );

}


/* =========================================================
   SAVE EXAM STATE
========================================================= */

function saveExamState() {

    try {

        sessionStorage.setItem(
            "examAnswers_" + examId,
            JSON.stringify(
                answers
            )
        );


        sessionStorage.setItem(
            "examMarked_" + examId,
            JSON.stringify(
                markedQuestions
            )
        );


    } catch (error) {

        console.error(
            "State save error:",
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
                "examAnswers_" + examId
            );


        const savedMarked =
            sessionStorage.getItem(
                "examMarked_" + examId
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
            "State restore error:",
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

    if (!automatic) {

        const confirmSubmit =
            confirm(
                "Are you sure you want to submit your examination?\n\n" +
                "You will not be able to change your answers after submission."
            );


        if (!confirmSubmit) {
            return;
        }

    }


    try {

        clearInterval(
            timerInterval
        );


        /* Calculate result */

        let attempted = 0;
        let correct = 0;
        let wrong = 0;
        let totalMarks = 0;
        let obtainedMarks = 0;


        const submittedAnswers = [];


        questions.forEach(
            function(
                question,
                index
            ) {

                const selected =
                    answers[index] ||
                    "";


                const correctAnswer =
                    String(
                        question.correctAnswer ||
                        ""
                    )
                    .trim()
                    .toUpperCase();


                const selectedAnswer =
                    String(
                        selected
                    )
                    .trim()
                    .toUpperCase();


                const marks =
                    Number(
                        question.marks ||
                        1
                    );


                totalMarks += marks;


                if (selectedAnswer) {

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


        /* Result status */

        const passMarks =
            Number(
                examData.passMarks ||
                Math.ceil(
                    totalMarks * 0.40
                )
            );


        const resultStatus =
            obtainedMarks >= passMarks
                ? "PASS"
                : "FAIL";


        /* Result document */

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
                    percentage.toFixed(2)
                ),

            passMarks:
                passMarks,

            result:
                resultStatus,

            answers:
                submittedAnswers,

            submittedAt:
                firebase.firestore.FieldValue.serverTimestamp()

        };


        /* Save result */

        const resultRef =
            await db
            .collection("examResults")
            .add(
                resultData
            );


        /* Mark candidate exam completed */

        await db
            .collection("candidates")
            .doc(currentUser.uid)
            .set({

                examStatus:
                    "completed",

                lastExamId:
                    examId,

                lastResultId:
                    resultRef.id,

                examSubmittedAt:
                    firebase.firestore.FieldValue
                    .serverTimestamp()

            }, {

                merge: true

            });


        /* Clear exam session */

        sessionStorage.removeItem(
            "examAnswers_" + examId
        );

        sessionStorage.removeItem(
            "examMarked_" + examId
        );

        sessionStorage.removeItem(
            "examEndTime_" + examId
        );


        sessionStorage.setItem(
            "lastResultId",
            resultRef.id
        );


        /* Go to result */

        window.location.replace(
            "result.html?resultId=" +
            encodeURIComponent(
                resultRef.id
            )
        );


    } catch (error) {

        console.error(
            "Submit error:",
            error
        );


        alert(
            "Unable to submit examination.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   PREVENT ACCIDENTAL BACK
========================================================= */

history.pushState(
    null,
    "",
    location.href
);


window.addEventListener(
    "popstate",
    function() {

        history.pushState(
            null,
            "",
            location.href
        );

        alert(
            "Please use the examination buttons. Do not go back during the examination."
        );

    }
);