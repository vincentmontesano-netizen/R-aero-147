export function ruleMatchesEmployee(
 emp:{jobTitle?:string|null;licenseCategories?:string|null},
 rule:{jobTitleContains?:string|null;licenseCategoryContains?:string|null},
):boolean {
 if (!rule.jobTitleContains && !rule.licenseCategoryContains) return true;
 const jt = (emp.jobTitle ?? '').toLowerCase();
 const lc = (emp.licenseCategories ?? '').toLowerCase();
 const jMatch = rule.jobTitleContains ? jt.includes(String(rule.jobTitleContains).toLowerCase()) : false;
 const lMatch = rule.licenseCategoryContains ? lc.includes(String(rule.licenseCategoryContains).toLowerCase()) : false;
 return jMatch || lMatch;
}
