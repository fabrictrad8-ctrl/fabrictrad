# Login provisioning recovery

FabricTrad keeps contact phone numbers unique across accounts. Authentication metadata may, however, retain a phone number already attached to another account. The live and versioned `ensure_current_account_profile` function therefore treats a conflicting metadata phone as deferred profile data instead of failing the user's login.

A conflicting number remains unassigned to the newer profile until the account owner resolves it through the protected contact-number flow. The account itself can still sign in and use its approved buyer or seller workspace.
