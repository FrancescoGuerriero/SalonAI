export const roadmapFeatures = [
  [12,"privacy","Privacy and Consent Centre","Choose optional analytics, personalisation and marketing consent with a dated server record.","Account and trust"],
  [13,"reviews","Verified Reviews and Ratings","Review a completed salon visit and follow its moderation status.","Account and trust"],
  [14,"favourites","Salon Favourites","Save live services, stylists and haircare products to your account.","Personalisation"],
  [15,"offers","Offers and Promotions","Discover active salon offers and securely claim eligible promotion codes.","Rewards"],
  [16,"wallet","Gift Card Wallet","Attach gift cards without storing or displaying their full secret codes.","Rewards"],
  [17,"loyalty","Loyalty Progress","See your live points balance, tier, progress and transaction history.","Rewards"],
  [18,"appointments","Appointment Self-Service","Request a cancellation or a new preferred appointment time and track the decision.","Bookings"],
  [19,"inbox","Customer Inbox","Read account-specific booking, order and salon notifications in one place.","Bookings"],
  [20,"pwa","Install SalonAI","Install the salon experience and keep a safe offline application shell.","Digital experience"],
  [21,"seo","Search Visibility","Verify the public salon pages expose useful titles, descriptions and crawl controls.","Digital experience"],
  [22,"analytics","Analytics Transparency","See exactly which optional measurement categories your consent enables.","Account and trust"],
  [23,"performance","Performance Diagnostics","Inspect real browser navigation timing, resources and connection status.","Digital experience"],
  [24,"responsive","Responsive Experience QA","Confirm the current viewport, touch readiness and responsive navigation mode.","Digital experience"],
  [25,"testing","Quality Centre","Run safe browser smoke checks for the customer session and core services.","Digital experience"],
  [26,"release","Release Readiness","Verify the deployed version, HTTPS, API reachability and install assets.","Digital experience"],
  [27,"salon-discovery","Salon Discovery Preferences","Save location, service, stylist and appointment-time preferences.","Personalisation"],
  [28,"consultation","Digital Consultation","Send hair goals, treatment history and sensitivities to the salon with explicit consent.","Personalisation"],
  [29,"inspiration","Inspiration Board","Build a private hairstyle board using secure image links and consultation notes.","Personalisation"],
  [30,"referrals","Customer Referral Hub","Invite a friend, copy a unique referral code and track qualification status.","Rewards"],
  [31,"feedback","Product Feedback","Send structured platform feedback and choose whether the team may contact you.","Account and trust"],
].map(([sprint,id,title,summary,group]) => ({ sprint,id,title,summary,group }));

export const roadmapFeatureMap = Object.fromEntries(
  roadmapFeatures.map((feature) => [feature.id, feature])
);
