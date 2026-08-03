# Login provisioning recovery

FabricTrad keeps contact phone numbers unique across accounts. Authentication metadata may, however, retain a phone number already attached to another account. The live and versioned `ensure_current_account_profile` function therefore treats a conflicting metadata phone as deferred profile data instead of failing the user's login.

Existing active profiles are also allowed to continue when an optional profile-repair request fails; a missing or inactive profile remains a hard error.
