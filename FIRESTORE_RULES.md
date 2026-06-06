rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function currentUserDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isAdmin() {
      return isSignedIn() && currentUserDoc().data.role == 'admin';
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isValidDiseases(data) {
      return data.diseases is list
        && data.diseases.size() <= 2
        && data.diseases.hasOnly(['diabetes', 'celiac']);
    }

    function isValidUserDocument() {
      return request.resource.data.keys().hasOnly([
        'id', '_id', 'uid',
        'firstName', 'lastName', 'email',
        'birthDate', 'gender',
        'height', 'weight',
        'dailyCalories', 'fatPercent',
        'authProvider',
        'hasDisease', 'diseases',
        'premium', 'aiUsage',
        'role', 'points',
        'createdAt', 'updatedAt'
      ])
      && request.resource.data.uid == request.auth.uid
      && request.resource.data.id == request.auth.uid
      && request.resource.data._id == request.auth.uid
      && request.resource.data.firstName is string
      && request.resource.data.lastName is string
      && request.resource.data.email is string
      && request.resource.data.birthDate is string
      && request.resource.data.gender is string
      && request.resource.data.height is number
      && request.resource.data.weight is number
      && request.resource.data.dailyCalories is number
      && request.resource.data.fatPercent is number
      && request.resource.data.authProvider is string
      && request.resource.data.hasDisease is bool
      && request.resource.data.role is string
      && request.resource.data.points is number
      && request.resource.data.premium is map
      && request.resource.data.premium.keys().hasOnly([
        'plan', 'status', 'startedAt', 'expiresAt', 'updatedAt'
      ])
      && request.resource.data.premium.plan in ['free', 'premium', 'elite_premium', 'elite_premium_plus']
      && request.resource.data.premium.status in ['inactive', 'active', 'grace', 'canceled']
      && (!request.resource.data.premium.keys().hasAny(['startedAt'])
        || request.resource.data.premium.startedAt == null
        || request.resource.data.premium.startedAt is timestamp)
      && (!request.resource.data.premium.keys().hasAny(['expiresAt'])
        || request.resource.data.premium.expiresAt == null
        || request.resource.data.premium.expiresAt is timestamp)
      && (!request.resource.data.premium.keys().hasAny(['updatedAt'])
        || request.resource.data.premium.updatedAt == null
        || request.resource.data.premium.updatedAt is timestamp)
      && request.resource.data.aiUsage is map
      && request.resource.data.aiUsage.keys().hasOnly([
        'dailyCount', 'dailyLimit', 'lastResetAt', 'updatedAt'
      ])
      && request.resource.data.aiUsage.dailyCount is number
      && request.resource.data.aiUsage.dailyLimit is number
      && (!request.resource.data.aiUsage.keys().hasAny(['lastResetAt'])
        || request.resource.data.aiUsage.lastResetAt == null
        || request.resource.data.aiUsage.lastResetAt is timestamp)
      && (!request.resource.data.aiUsage.keys().hasAny(['updatedAt'])
        || request.resource.data.aiUsage.updatedAt == null
        || request.resource.data.aiUsage.updatedAt is timestamp)
      && isValidDiseases(request.resource.data)
      && ((request.resource.data.hasDisease == true && request.resource.data.diseases.size() > 0)
        || (request.resource.data.hasDisease == false && request.resource.data.diseases.size() == 0));
    }

    function keepsProtectedUserFields() {
      return (
        (resource.data.keys().hasAll(['role'])
          ? request.resource.data.role == resource.data.role
          : request.resource.data.role == 'user')
        &&
        (resource.data.keys().hasAll(['points'])
          ? request.resource.data.points == resource.data.points
          : request.resource.data.points == 0)
        &&
        (resource.data.keys().hasAll(['premium'])
          ? request.resource.data.premium == resource.data.premium
          : request.resource.data.premium.plan == 'free')
        &&
        (resource.data.keys().hasAll(['aiUsage'])
          ? request.resource.data.aiUsage == resource.data.aiUsage
          : request.resource.data.aiUsage.dailyCount == 0)
      );
    }

    function adminCanAdjustUserPoints() {
      return isAdmin()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['points', 'updatedAt'])
        && request.resource.data.points is number;
    }

    function adminCanAdjustSubscriptionAndAiUsage() {
      return isAdmin()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['premium', 'aiUsage', 'updatedAt'])
        && request.resource.data.premium is map
        && request.resource.data.premium.keys().hasOnly(['plan', 'status', 'startedAt', 'expiresAt', 'updatedAt'])
        && request.resource.data.premium.plan in ['free', 'premium', 'elite_premium', 'elite_premium_plus']
        && request.resource.data.premium.status in ['inactive', 'active', 'grace', 'canceled']
        && request.resource.data.aiUsage is map
        && request.resource.data.aiUsage.keys().hasOnly(['dailyCount', 'dailyLimit', 'lastResetAt', 'updatedAt'])
        && request.resource.data.aiUsage.dailyCount is number
        && request.resource.data.aiUsage.dailyLimit is number;
    }

    function isValidFoodSubmissionDocument() {
      return request.resource.data.keys().hasOnly([
        'name', 'brandName', 'serving',
        'calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'fiber', 'sugar', 'sodium', 'potassium',
        'calcium', 'iron', 'magnesium', 'phosphorus', 'zinc', 'vitaminC', 'vitaminB12', 'glycemicIndex',
        'diseaseTags', 'unsuitableDiseaseTags', 'notes', 'source',
        'status', 'reviewedBy', 'reviewNote', 'pointsAwarded',
        'submittedBy', 'submittedByEmail',
        'createdAt', 'updatedAt'
      ])
      && request.resource.data.name is string
      && request.resource.data.brandName is string
      && request.resource.data.serving is string
      && request.resource.data.calories is number
      && request.resource.data.protein is number
      && request.resource.data.carbs is number
      && request.resource.data.fat is number
      && request.resource.data.saturatedFat is number
      && request.resource.data.fiber is number
      && request.resource.data.sugar is number
      && request.resource.data.sodium is number
      && request.resource.data.potassium is number
      && (!request.resource.data.keys().hasAny(['calcium']) || request.resource.data.calcium is number)
      && (!request.resource.data.keys().hasAny(['iron']) || request.resource.data.iron is number)
      && (!request.resource.data.keys().hasAny(['magnesium']) || request.resource.data.magnesium is number)
      && (!request.resource.data.keys().hasAny(['phosphorus']) || request.resource.data.phosphorus is number)
      && (!request.resource.data.keys().hasAny(['zinc']) || request.resource.data.zinc is number)
      && (!request.resource.data.keys().hasAny(['vitaminC']) || request.resource.data.vitaminC is number)
      && (!request.resource.data.keys().hasAny(['vitaminB12']) || request.resource.data.vitaminB12 is number)
      && (!request.resource.data.keys().hasAny(['glycemicIndex']) || request.resource.data.glycemicIndex is number)
      && request.resource.data.diseaseTags is list
      && request.resource.data.diseaseTags.hasOnly(['diabetes', 'celiac'])
      && (!request.resource.data.keys().hasAny(['unsuitableDiseaseTags'])
        || (request.resource.data.unsuitableDiseaseTags is list
          && request.resource.data.unsuitableDiseaseTags.hasOnly(['diabetes', 'celiac'])))
      && (!request.resource.data.keys().hasAny(['unsuitableDiseaseTags'])
        || !request.resource.data.diseaseTags.hasAny(request.resource.data.unsuitableDiseaseTags))
      && request.resource.data.notes is string
      && request.resource.data.source is string
      && request.resource.data.status is string
      && request.resource.data.reviewedBy is string
      && request.resource.data.reviewNote is string
      && request.resource.data.pointsAwarded is number
      && request.resource.data.submittedBy is string
      && request.resource.data.submittedByEmail is string;
    }

    function canCreateFoodSubmission() {
      return isSignedIn()
        && isValidFoodSubmissionDocument()
        && request.resource.data.submittedBy == request.auth.uid
        && request.resource.data.status == 'pending'
        && request.resource.data.reviewedBy == ''
        && request.resource.data.reviewNote == ''
        && request.resource.data.pointsAwarded == 0
        && request.resource.data.source == 'user';
    }

    function canUpdateFoodSubmission() {
      return isAdmin()
        && isValidFoodSubmissionDocument()
        && request.resource.data.submittedBy == resource.data.submittedBy
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.status in ['pending', 'approved', 'rejected'];
    }

    function isValidFoodIssueReportCreate() {
      return request.resource.data.keys().hasOnly([
        'foodSubmissionId', 'foodName',
        'reportReason',
        'status', 'adminNote',
        'reportedBy', 'reportedByEmail',
        'firstReporterUid',
        'pointsGranted', 'resolvedBy',
        'createdAt', 'updatedAt'
      ])
      && request.resource.data.foodSubmissionId is string
      && request.resource.data.foodName is string
      && request.resource.data.reportReason is string
      && request.resource.data.status == 'pending'
      && request.resource.data.adminNote is string
      && request.resource.data.reportedBy == request.auth.uid
      && request.resource.data.reportedByEmail is string
      && request.resource.data.firstReporterUid is string
      && request.resource.data.pointsGranted is bool
      && request.resource.data.resolvedBy is string;
    }

    function isValidFoodIssueReportUpdate() {
      return request.resource.data.keys().hasOnly([
        'foodSubmissionId', 'foodName',
        'reportReason',
        'status', 'adminNote',
        'reportedBy', 'reportedByEmail',
        'firstReporterUid',
        'pointsGranted', 'resolvedBy',
        'createdAt', 'updatedAt'
      ])
      && request.resource.data.foodSubmissionId == resource.data.foodSubmissionId
      && request.resource.data.foodName == resource.data.foodName
      && request.resource.data.reportReason == resource.data.reportReason
      && request.resource.data.reportedBy == resource.data.reportedBy
      && request.resource.data.reportedByEmail == resource.data.reportedByEmail
      && request.resource.data.firstReporterUid == resource.data.firstReporterUid
      && request.resource.data.createdAt == resource.data.createdAt
      && request.resource.data.status in ['pending', 'resolved', 'rejected']
      && request.resource.data.adminNote is string
      && request.resource.data.pointsGranted is bool
      && request.resource.data.resolvedBy is string;
    }

    function isValidMealPlanDocument() {
      return request.resource.data.keys().hasOnly([
        'userId', 'title', 'weekStartDate', 'days', 'createdAt', 'updatedAt'
      ])
      && request.resource.data.userId is string
      && request.resource.data.title is string
      && request.resource.data.title.size() > 0
      && request.resource.data.weekStartDate is string
      && request.resource.data.days is map;
    }

    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId)
        && isValidUserDocument()
        && request.resource.data.role == 'user'
        && request.resource.data.points == 0;
      allow update: if isOwner(userId)
        && isValidUserDocument()
        && keepsProtectedUserFields()
        || adminCanAdjustUserPoints()
        || adminCanAdjustSubscriptionAndAiUsage();
      allow delete: if false;
    }

    match /foodSubmissions/{docId} {
      allow create: if canCreateFoodSubmission();
      allow read: if isSignedIn()
        && (
          resource.data.submittedBy == request.auth.uid
          || isAdmin()
          || resource.data.status == 'approved'
        );
      allow update: if canUpdateFoodSubmission();
      allow delete: if isAdmin();
    }

    match /foodIssueReports/{docId} {
      allow create: if isSignedIn() && isValidFoodIssueReportCreate();
      allow read: if isSignedIn()
        && (
          resource.data.reportedBy == request.auth.uid
          || isAdmin()
        );
      allow update: if isAdmin() && isValidFoodIssueReportUpdate();
      allow delete: if isAdmin();
    }

    match /mealPlans/{docId} {
      allow create: if isSignedIn()
        && isValidMealPlanDocument()
        && request.resource.data.userId == request.auth.uid;
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow update: if isSignedIn()
        && resource.data.userId == request.auth.uid
        && isValidMealPlanDocument()
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }

    match /exercisePlans/{docId} {
      allow read, write: if false;
    }

    match /waterIntakes/{docId} {
      allow read, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
