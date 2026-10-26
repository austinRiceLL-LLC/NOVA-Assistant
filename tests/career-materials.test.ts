import assert from "node:assert/strict";
import test from "node:test";
import { buildResumeMaterial, reviewBlockers, validatePolicyDraft, type ApprovedFact, type BaseResume, type JobContext } from "../lib/career/materials.ts";

const base: BaseResume = { id:"resume-1",version:1,content:"Austin Rice\nEducation\nGraduate program expected May 2027\nProjects\nBuilt a production search prototype using Python.",approvedAt:1 };
const facts: ApprovedFact[] = [
  {id:"fact-1",claim:"Built an information retrieval pipeline using BM25 and Python.",sourceLabel:"Approved resume project",approvedAt:1},
  {id:"fact-2",claim:"Used TypeScript in a client application.",sourceLabel:"Portfolio",approvedAt:1},
  {id:"unapproved",claim:"Held a top secret clearance.",sourceLabel:"Unknown",approvedAt:0},
];
const job: JobContext = {id:"job-1",employer:"Example",title:"AI Engineer",description:"Build a Python and BM25 retrieval system. Security clearance required.",location:"Washington, DC",salaryMin:null,salaryMax:null,salaryCurrency:null};

test("tailored material uses only exact approved claims and preserves the base resume", () => {
  const result = buildResumeMaterial(base,facts,job);
  assert.ok(result.content.startsWith(base.content));
  assert.ok(result.content.includes(facts[0].claim));
  assert.ok(!result.content.includes(facts[2].claim));
  assert.deepEqual(result.factIds,["fact-1"]);
  assert.equal(result.baseResumeId,base.id);
});
test("unapproved resume cannot produce a draft", () => {
  assert.throws(() => buildResumeMaterial({...base,approvedAt:0},facts,job),/Approve a base resume/);
});
test("legal, clearance and unknown salary requirements stay in review", () => {
  const blockers = reviewBlockers({...job,description:job.description+" US citizenship and work authorization required."},true,2);
  assert.ok(blockers.some(item => item.includes("Clearance")));
  assert.ok(blockers.some(item => item.includes("Work authorization")));
  assert.ok(blockers.some(item => item.includes("salary is unknown")));
});
test("policy form can save only a draft", () => {
  const policy = validatePolicyDraft({allowedEmployers:["Example"],locations:["Washington, DC"],minimumSalary:110000,dailyCap:2,status:"active"});
  assert.equal(policy.status,"draft");
  assert.throws(() => validatePolicyDraft({allowedEmployers:[],locations:[],minimumSalary:0,dailyCap:100}),/Invalid daily cap/);
});
