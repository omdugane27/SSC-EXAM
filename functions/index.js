const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

setGlobalOptions({
  region: "asia-south1",
  maxInstances: 10
});

/*
  SECURE INVIGILATOR REGISTRATION

  Only an authenticated Admin can call this function.

  Required Firestore document:

  admins/{ADMIN_UID}
    role: "admin"
    status: "active"

  Created document:

  invigilators/{NEW_USER_UID}
*/

exports.registerInvigilator = onCall(async (request) => {

  // 1. Check Admin Authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Admin login required."
    );
  }

  const adminUid = request.auth.uid;

  // 2. Verify Admin in Firestore
  const adminDoc = await db
    .collection("admins")
    .doc(adminUid)
    .get();

  if (!adminDoc.exists) {
    throw new HttpsError(
      "permission-denied",
      "You are not registered as an administrator."
    );
  }

  const adminData = adminDoc.data();

  if (
    adminData.role !== "admin" ||
    adminData.status !== "active"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Admin account is not active."
    );
  }

  // 3. Get Registration Data
  const data = request.data || {};

  const fullName = String(data.fullName || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const mobile = String(data.mobile || "").trim();
  const employeeId = String(data.employeeId || "").trim();
  const centre = String(data.centre || "").trim();
  const password = String(data.password || "");

  // 4. Validate Required Fields
  if (
    !fullName ||
    !email ||
    !mobile ||
    !employeeId ||
    !centre ||
    !password
  ) {
    throw new HttpsError(
      "invalid-argument",
      "All invigilator fields are required."
    );
  }

  // 5. Validate Password
  if (password.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "Password must contain at least 8 characters."
    );
  }

  // 6. Validate Mobile
  if (!/^[0-9]{10}$/.test(mobile)) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid 10-digit mobile number."
    );
  }

  // 7. Check Employee ID Already Exists
  const employeeSnapshot = await db
    .collection("invigilators")
    .where("employeeId", "==", employeeId)
    .limit(1)
    .get();

  if (!employeeSnapshot.empty) {
    throw new HttpsError(
      "already-exists",
      "This Employee ID is already registered."
    );
  }

  // 8. Create Firebase Authentication User
  let newUser;

  try {
    newUser = await auth.createUser({
      email: email,
      password: password,
      displayName: fullName
    });
  } catch (error) {

    if (error.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "This email is already registered."
      );
    }

    if (error.code === "auth/invalid-email") {
      throw new HttpsError(
        "invalid-argument",
        "Invalid email address."
      );
    }

    if (error.code === "auth/password-does-not-meet-requirements") {
      throw new HttpsError(
        "invalid-argument",
        "Password does not meet security requirements."
      );
    }

    throw new HttpsError(
      "internal",
      "Unable to create Firebase Authentication account."
    );
  }

  // 9. Create Invigilator Firestore Document
  try {

    await db
      .collection("invigilators")
      .doc(newUser.uid)
      .set({
        uid: newUser.uid,
        fullName: fullName,
        email: email,
        mobile: mobile,
        employeeId: employeeId,
        invigilatorId: employeeId,
        centre: centre,
        role: "invigilator",
        status: "active",

        createdBy: adminUid,

        createdAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

  } catch (error) {

    // If Firestore creation fails,
    // remove the Authentication account too.
    try {
      await auth.deleteUser(newUser.uid);
    } catch (deleteError) {
      console.error(
        "Failed to rollback Authentication user:",
        deleteError
      );
    }

    console.error(
      "Failed to create invigilator document:",
      error
    );

    throw new HttpsError(
      "internal",
      "Invigilator registration failed."
    );
  }

  // 10. Return Safe Response
  return {
    success: true,
    message: "Invigilator registered successfully.",
    invigilator: {
      uid: newUser.uid,
      fullName: fullName,
      email: email,
      employeeId: employeeId,
      centre: centre,
      role: "invigilator",
      status: "active"
    }
  };
});
