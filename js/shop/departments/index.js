/* ============================================================
   DEPARTMENT REGISTRY
   Add a department here and it exists in the shop.
   Only the one in OPEN_DEPARTMENT_ID has a built, walkable aisle.
   ============================================================ */

import rice from './rice.js';

/* Change this single line when the next department's aisle is ready. */
export const OPEN_DEPARTMENT_ID = 'rice';

const all = [rice];

export const DEPARTMENTS = all.map((d) => ({
  id: d.id,
  name: d.name,
  nameBn: d.nameBn,
  icon: d.icon,
  colour: d.colour,
  tagline: d.tagline,
  taglineBn: d.taglineBn,
  sections: d.sections,
  productCount: d.products.length,
  open: d.id === OPEN_DEPARTMENT_ID,
}));

export const getDepartment = (id) => all.find((d) => d.id === id) || null;

export const openDepartment = () => getDepartment(OPEN_DEPARTMENT_ID);

/* Every product in the shop, each tagged with its department. */
export const ALL_PRODUCTS = all.flatMap((d) =>
  d.products.map((p) => ({ ...p, departmentId: d.id, departmentName: d.name })));

export const findProduct = (id) => ALL_PRODUCTS.find((p) => p.id === id) || null;

export const sectionOf = (dept, sectionId) =>
  (dept?.sections || []).find((s) => s.id === sectionId) || null;
