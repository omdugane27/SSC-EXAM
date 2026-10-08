<!-- ==========================================
     FIREBASE
     ========================================== -->

<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-compat.js"></script>

<script src="./Js/firebase-config.js"></script>

<script>

    // ============================================
    // ELEMENTS
    // ============================================

    const loginForm =
        document.getElementById("loginForm");

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");

    const loginBtn =
        document.getElementById("loginBtn");

    const message =
        document.getElementById("message");

    const forgotPassword =
        document.getElementById("forgotPassword");

    const showPassword =
        document.getElementById("showPassword");


    // Forgot Password Modal

    const forgotModal =
        document.getElementById("forgotModal");

    const resetEmail =
        document.getElementById("resetEmail");

    const resetBtn =
        document.getElementById("resetBtn");

    const closeModal =
        document.getElementById("closeModal");

    const resetMessage =
        document.getElementById("resetMessage");


    // ============================================
    // MESSAGE
    // ============================================

    function showMessage(text, success = false) {

        message.textContent = text;

        message.style.display = "block";

        if (success) {

            message.className =
                "message success";

        } else {

            message.className =
                "message error";
        }
    }


    // ============================================
    // RESET MESSAGE
    // ============================================

    function showResetMessage(text, success = false) {

        resetMessage.textContent = text;

        if (success) {

            resetMessage.className =
                "reset-message reset-success";

        } else {

            resetMessage.className =
                "reset-message reset-error";
        }
    }


    // ============================================
    // SHOW / HIDE PASSWORD
    // ============================================

    showPassword.addEventListener(
        "click",
        function () {

            if (
                passwordInput.type === "password"
            ) {

                passwordInput.type = "text";

                showPassword.textContent =
                    "Hide";

            } else {

                passwordInput.type = "password";

                showPassword.textContent =
                    "Show";
            }

        }
    );


    // ============================================
    // LOGIN
    // ============================================

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                emailInput.value
                    .trim()
                    .toLowerCase();


            const password =
                passwordInput.value;


            // Validation

            if (!email) {

                showMessage(
                    "Please enter your email."
                );

                return;
            }


            if (!password) {

                showMessage(
                    "Please enter your password."
                );

                return;
            }


            loginBtn.disabled = true;

            loginBtn.textContent =
                "Logging in...";


            try {

                // =================================
                // FIREBASE LOGIN
                // =================================

                const result =
                    await auth.signInWithEmailAndPassword(
                        email,
                        password
                    );


                const user =
                    result.user;


                console.log(
                    "Login successful:",
                    user.uid
                );


                // =================================
                // CHECK CANDIDATE DOCUMENT
                // =================================

                const candidateDoc =
                    await db
                        .collection("candidates")
                        .doc(user.uid)
                        .get();


                if (!candidateDoc.exists) {

                    showMessage(
                        "Candidate profile not found."
                    );

                    await auth.signOut();

                    return;
                }


                const candidate =
                    candidateDoc.data();


                // =================================
                // CHECK ACCOUNT STATUS
                // =================================

                if (
                    candidate.status &&
                    candidate.status !== "active"
                ) {

                    showMessage(
                        "Your candidate account is not active."
                    );

                    await auth.signOut();

                    return;
                }


                // =================================
                // LOGIN SUCCESS
                // =================================

                showMessage(
                    "Login successful! Opening dashboard...",
                    true
                );


                setTimeout(
                    function () {

                        window.location.href =
                            "candidate-dashboard.html";

                    },
                    1200
                );


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                let errorMessage =
                    "Login failed.";


                switch (error.code) {

                    case "auth/user-not-found":

                        errorMessage =
                            "No account found with this email.";

                        break;


                    case "auth/wrong-password":

                        errorMessage =
                            "Incorrect password.";

                        break;


                    case "auth/invalid-credential":

                        errorMessage =
                            "Invalid email or password.";

                        break;


                    case "auth/invalid-email":

                        errorMessage =
                            "Invalid email address.";

                        break;


                    case "auth/user-disabled":

                        errorMessage =
                            "This account has been disabled.";

                        break;


                    case "auth/too-many-requests":

                        errorMessage =
                            "Too many attempts. Please try again later.";

                        break;


                    case "auth/network-request-failed":

                        errorMessage =
                            "Network error. Check your internet connection.";

                        break;


                    default:

                        errorMessage =
                            error.message ||
                            "Unable to login.";

                        break;
                }


                showMessage(
                    errorMessage
                );

            } finally {

                loginBtn.disabled = false;

                loginBtn.textContent =
                    "Login";
            }

        }
    );


    // ============================================
    // OPEN FORGOT PASSWORD MODAL
    // ============================================

    forgotPassword.addEventListener(
        "click",
        function (event) {

            event.preventDefault();


            forgotModal.classList.add(
                "active"
            );


            // Clear old message

            resetMessage.textContent = "";

            resetMessage.className =
                "reset-message";


            // Automatically copy login email

            const loginEmail =
                emailInput.value.trim();


            if (loginEmail) {

                resetEmail.value =
                    loginEmail;
            }


            setTimeout(
                function () {

                    resetEmail.focus();

                },
                100
            );

        }
    );


    // ============================================
    // CLOSE MODAL
    // ============================================

    closeModal.addEventListener(
        "click",
        function () {

            forgotModal.classList.remove(
                "active"
            );

            resetMessage.textContent = "";

            resetMessage.className =
                "reset-message";
        }
    );


    // ============================================
    // CLOSE MODAL OUTSIDE
    // ============================================

    forgotModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target === forgotModal
            ) {

                forgotModal.classList.remove(
                    "active"
                );
            }

        }
    );


    // ============================================
    // SEND PASSWORD RESET EMAIL
    // ============================================

    resetBtn.addEventListener(
        "click",
        async function () {

            const email =
                resetEmail.value
                    .trim()
                    .toLowerCase();


            // Validation

            if (!email) {

                showResetMessage(
                    "Please enter your registered email address."
                );

                resetEmail.focus();

                return;
            }


            // Basic email validation

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !emailPattern.test(email)
            ) {

                showResetMessage(
                    "Please enter a valid email address."
                );

                return;
            }


            // Loading

            resetBtn.disabled = true;

            resetBtn.textContent =
                "Sending...";


            try {

                // =================================
                // FIREBASE PASSWORD RESET
                // =================================

                await auth.sendPasswordResetEmail(
                    email
                );


                showResetMessage(
                    "Password reset link sent successfully! Check your Inbox or Spam folder.",
                    true
                );


                resetBtn.textContent =
                    "Email Sent";


                // Close after 3 seconds

                setTimeout(
                    function () {

                        forgotModal.classList.remove(
                            "active"
                        );

                        resetBtn.disabled =
                            false;

                        resetBtn.textContent =
                            "Send Reset Link";

                        resetEmail.value = "";

                        resetMessage.textContent =
                            "";

                        resetMessage.className =
                            "reset-message";

                    },
                    3000
                );


            } catch (error) {

                console.error(
                    "Password reset error:",
                    error
                );


                let errorMessage =
                    "Unable to send password reset email.";


                switch (error.code) {

                    case "auth/user-not-found":

                        errorMessage =
                            "No account found with this email.";

                        break;


                    case "auth/invalid-email":

                        errorMessage =
                            "Invalid email address.";

                        break;


                    case "auth/too-many-requests":

                        errorMessage =
                            "Too many requests. Please try again later.";

                        break;


                    case "auth/network-request-failed":

                        errorMessage =
                            "Network error. Check your internet connection.";

                        break;


                    default:

                        errorMessage =
                            error.message ||
                            "Unable to send password reset email.";

                        break;
                }


                showResetMessage(
                    errorMessage
                );


                resetBtn.disabled = false;

                resetBtn.textContent =
                    "Send Reset Link";
            }

        }
    );


    // ============================================
    // ESC KEY CLOSE
    // ============================================

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape"
            ) {

                forgotModal.classList.remove(
                    "active"
                );
            }

        }
    );

</script>