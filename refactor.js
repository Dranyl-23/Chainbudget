const fs = require('fs');

const files = [
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/approvals/page.tsx",
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/audit/page.tsx",
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/budget/page.tsx",
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/page.tsx",
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/reports/page.tsx",
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/team/page.tsx",
  "c:/Users/Alfie Lynard/OneDrive/Desktop/Chainbudgets/frontend/src/app/dashboard/transactions/page.tsx",
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/const { user } = useAuth\(\);/g, "const { user, activeOrgId } = useAuth();");
  
  content = content.replace(/const orgRef = user\?\.memberships\?\.\[0\]\?\.organization;\s*const orgId = orgRef \? \(typeof orgRef === "string" \? orgRef : \(orgRef as any\)\._id \|\| ""\) : "";/g, "const orgId = activeOrgId;");

  content = content.replace(/if \(!orgRef\) \{/g, "if (!activeOrgId) {");
  
  content = content.replace(/\[user\]/g, "[activeOrgId]");
  content = content.replace(/\[user,/g, "[activeOrgId,");

  fs.writeFileSync(file, content);
  console.log("Updated", file);
});
