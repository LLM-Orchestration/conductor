import{B as e,C as t,F as n,H as r,I as i,J as a,L as o,P as s,Q as c,R as l,T as u,V as d,X as f,_ as p,b as ee,c as m,d as h,g as te,h as g,j as _,k as v,m as ne,q as y,r as b,s as re,v as x,w as S,x as C,y as w,z as T}from"../chunks/BPPyitxZ.js";import{c as E}from"../chunks/9DQ6vL3C.js";import"../chunks/v_jBEYI6.js";import{t as D}from"../chunks/lxyIK3fN.js";import{a as O,r as k}from"../chunks/6mRxH2fI.js";import{t as A}from"../chunks/Ct_7rPsC.js";var j=c({prerender:()=>!1}),M=C(`<p>Loading details...</p>`),N=C(`<p class="error svelte-vsphkj"> </p>`),ie=C(`<div class="warning svelte-vsphkj"><p class="svelte-vsphkj"><strong>Multiple pull requests are linked to this issue.</strong></p> <p class="svelte-vsphkj">Please approve and merge them manually on GitHub. The "Approve & Merge" button is disabled to avoid ambiguity.</p></div>`),ae=C(`<details class="artifact-card svelte-vsphkj"><summary class="svelte-vsphkj"> </summary> <div class="markdown-content svelte-vsphkj"></div></details>`),oe=C(`<p class="info svelte-vsphkj"> </p>`),se=C(`<section class="artifacts"><h2 class="svelte-vsphkj"> </h2> <p class="pr-link svelte-vsphkj"><a target="_blank" rel="noopener noreferrer" class="svelte-vsphkj"> </a></p> <!></section>`),ce=C(`<p class="info svelte-vsphkj">No linked pull requests found.</p>`),le=C(`<button class="btn approve svelte-vsphkj"> </button>`),ue=C(`<header class="svelte-vsphkj"><h1 class="svelte-vsphkj"> <span class="issue-number svelte-vsphkj"> </span></h1> <p class="repo-name svelte-vsphkj"> </p></header> <!> <!> <!> <section class="actions svelte-vsphkj"><h2 class="svelte-vsphkj">Actions</h2> <div class="comment-area svelte-vsphkj"><label for="comment" class="svelte-vsphkj">Comment (Required for "In Progress", Optional for "Todo")</label> <textarea id="comment" placeholder="Add your feedback here..." class="svelte-vsphkj"></textarea></div> <div class="button-group svelte-vsphkj"><!> <button class="btn in-progress svelte-vsphkj">Comment & Move to In Progress</button> <button class="btn todo svelte-vsphkj">Back to TODO</button></div></section>`,1),P=C(`<div class="container svelte-vsphkj"><nav class="svelte-vsphkj"><a class="svelte-vsphkj">← Back to Approval Queue</a></nav> <!></div>`);function F(t,c){a(c,!0);let C=r(()=>D.params.owner),j=r(()=>D.params.repo),F=r(()=>D.params.issue_number),I=r(()=>D.url.searchParams.get(`itemId`)),L=d(null),R=d(T([])),z=d(!0),B=d(null),V=d(``),H=d(!1),U=d(``),W=d(``),G=d(``),K=d(null),q=`LLM-Orchestration`,J={TODO:`f75ad846`,IN_PROGRESS:`47fc9ee4`,HUMAN_REVIEW:`0fd775be`,DONE:`98236657`},de={CONDUCTOR:`e1ea423a`,CODER:`ea5e8807`};b(async()=>{let t=k();if(!t){O();return}try{await fe(t)}catch(t){console.error(t),e(B,t instanceof Error?t.message:String(t),!0)}finally{e(z,!1)}});async function fe(t){let n=u(C),r=u(j),i=u(F);if(!n||!r||!i)throw Error(`Missing route parameters`);let a=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
		query GetDetails($owner: String!, $repo: String!, $number: Int!, $org: String!, $projectNumber: Int!) {
			organization(login: $org) {
				projectV2(number: $projectNumber) {
					id
					fields(first: 50) {
						nodes {
							... on ProjectV2Field {
								id
								name
							}
							... on ProjectV2SingleSelectField {
								id
								name
							}
						}
					}
				}
			}
			repository(owner: $owner, name: $repo) {
				mergeCommitAllowed
				squashMergeAllowed
				rebaseMergeAllowed
				issue(number: $number) {
					id
					title
					body
					labels(first: 20) {
						nodes { name }
					}
					projectItems(first: 10) {
						nodes {
							id
						}
					}
					timelineItems(first: 50, itemTypes: [CROSS_REFERENCED_EVENT]) {
						nodes {
							... on CrossReferencedEvent {
								source {
									... on PullRequest {
										number
										url
										state
										baseRepository {
											owner { login }
											name
										}
									}
								}
							}
						}
					}
				}
			}
		}
	`,variables:{owner:n,repo:r,number:parseInt(i,10),org:q,projectNumber:1}})})).json();if(a.errors)throw Error(a.errors[0].message);let o=a.data.organization.projectV2;e(U,o.id,!0);let s=o.fields.nodes.find(e=>e.name===`Status`),c=o.fields.nodes.find(e=>e.name===`Persona`);s&&e(W,s.id,!0),c&&e(G,c.id,!0);let l=a.data.repository;if(e(L,l.issue,!0),!u(L))throw Error(`Issue not found`);if(u(I))e(K,u(I),!0);else if(u(L).projectItems.nodes.length>0)e(K,u(L).projectItems.nodes[0].id,!0);else{let a=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
			query FallbackProjectItem($org: String!, $number: Int!) {
				organization(login: $org) {
					projectV2(number: $number) {
						items(first: 100) {
							nodes {
								id
								content {
									... on Issue {
										number
										repository {
											owner { login }
											name
										}
									}
								}
							}
						}
					}
				}
			}
		`,variables:{org:q,number:1}})})).json();if(!a.errors){let t=a.data.organization.projectV2.items.nodes.find(e=>e.content?.number===parseInt(i,10)&&e.content?.repository?.owner?.login===n&&e.content?.repository?.name===r);t&&e(K,t.id,!0)}}let d=u(L).timelineItems.nodes.filter(e=>e.source?.number).map(e=>({...e.source,repositorySettings:{mergeCommitAllowed:l.mergeCommitAllowed,squashMergeAllowed:l.squashMergeAllowed,rebaseMergeAllowed:l.rebaseMergeAllowed}})),f=new Map;for(let e of d)f.set(e.number,e);e(R,await Promise.all(Array.from(f.values()).map(async e=>{let n=await fetch(`https://api.github.com/repos/${e.baseRepository.owner.login}/${e.baseRepository.name}/pulls/${e.number}/files`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok)throw Error(`Failed to fetch PR files for #${e.number}`);let r=(await n.json()).filter(e=>e.filename.endsWith(`.md`)),i=await Promise.all(r.map(async e=>{let n=await(await fetch(e.contents_url,{headers:{Authorization:`Bearer ${t}`,Accept:`application/vnd.github.v3.raw`}})).text(),r=A.parse(n);return{filename:e.filename,raw_url:e.raw_url,content:pe(r,e.raw_url)}}));return{...e,markdownFiles:i}})),!0)}function pe(e,t){let n=decodeURIComponent(t);return e.replace(/(src|href)=["']([^"']+)["']/g,(e,t,r)=>{if(/^(https?:\/\/|\/|#|mailto:|data:)/i.test(r))return e;try{return`${t}="${new URL(r,n).href}"`}catch{return e}})}async function Y(e,t){let n=k();if(!u(K))throw Error(`Project Item ID not found. Cannot update project status.`);let r,i;t?(r=`
			mutation UpdateField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
				updateProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId,
					value: { singleSelectOptionId: $optionId }
				}) {
					projectV2Item { id }
				}
			}
		`,i={projectId:u(U),itemId:u(K),fieldId:e,optionId:t}):(r=`
			mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
				clearProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId
				}) {
					projectV2Item { id }
				}
			}
		`,i={projectId:u(U),itemId:u(K),fieldId:e});let a=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${n}`,"Content-Type":`application/json`},body:JSON.stringify({query:r,variables:i})})).json();if(a.errors)throw Error(a.errors[0].message)}async function X(e,t){let n=u(C),r=u(j),i=u(F);if(!n||!r||!i)throw Error(`Missing route parameters`);if(!u(L))throw Error(`Issue data not found`);let a=k(),o=u(L).labels.nodes.map(e=>e.name).filter(e=>!t.includes(e));for(let t of e)o.includes(t)||o.push(t);if(!(await fetch(`https://api.github.com/repos/${n}/${r}/issues/${i}/labels`,{method:`PUT`,headers:{Authorization:`Bearer ${a}`,"Content-Type":`application/json`},body:JSON.stringify({labels:o})})).ok)throw Error(`Failed to update labels`)}async function Z(e){let t=u(C),n=u(j),r=u(F);if(!t||!n||!r)throw Error(`Missing route parameters`);let i=k();if(!(await fetch(`https://api.github.com/repos/${t}/${n}/issues/${r}/comments`,{method:`POST`,headers:{Authorization:`Bearer ${i}`,"Content-Type":`application/json`},body:JSON.stringify({body:e})})).ok)throw Error(`Failed to add comment`)}async function me(){if(confirm(`Are you sure you want to approve and merge?`)&&u(L)){e(H,!0);try{let e=k();await Z(`Approved`);let t=u(R).length===1?u(R)[0]:null;if(t&&t.state===`OPEN`){let n=`merge`;t.repositorySettings.squashMergeAllowed?n=`squash`:t.repositorySettings.rebaseMergeAllowed?n=`rebase`:t.repositorySettings.mergeCommitAllowed&&(n=`merge`);let r=await fetch(`https://api.github.com/repos/${t.baseRepository.owner.login}/${t.baseRepository.name}/pulls/${t.number}/merge`,{method:`PUT`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({merge_method:n})});if(!r.ok){let e=await r.json();throw Error(`Failed to merge PR: ${e.message}`)}}await Y(u(W),J.DONE),await Y(u(G),null),await X([],u(L).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)||e.startsWith(`branch:`))),alert(`Approved and merged successfully!`),window.location.href=`${E}/approval`}catch(e){let t=e instanceof Error?e.message:String(e);alert(t)}finally{e(H,!1)}}}async function he(){if(!u(V).trim()){alert(`Please enter a comment.`);return}if(u(L)){e(H,!0);try{await Z(u(V)),await Y(u(W),J.IN_PROGRESS),await Y(u(G),de.CONDUCTOR),await X([`persona: conductor`],u(L).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)&&e!==`persona: conductor`)),alert(`Comment added and moved back to In Progress.`),window.location.href=`${E}/approval`}catch(e){let t=e instanceof Error?e.message:String(e);alert(t)}finally{e(H,!1)}}}async function ge(){if(u(L)){e(H,!0);try{u(V).trim()&&await Z(u(V)),await Y(u(W),J.TODO),await Y(u(G),null),await X([],u(L).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`))),alert(`Moved back to Todo.`),window.location.href=`${E}/approval`}catch(e){let t=e instanceof Error?e.message:String(e);alert(t)}finally{e(H,!1)}}}var Q=P();h(`vsphkj`,e=>{v(()=>{n.title=`Approve Issue #${u(F)??``}`})});var $=i(Q),_e=i($);f($);var ve=l($,2),ye=e=>{w(e,M())},be=e=>{var t=N(),n=i(t,!0);f(t),_(()=>x(n,u(B))),w(e,t)},xe=t=>{var n=ue(),r=o(n),a=i(r),c=i(a),d=l(c),h=i(d);f(d),f(a);var v=l(a,2),y=i(v);f(v),f(r);var b=l(r,2),T=e=>{w(e,ie())};p(b,e=>{u(R).length>1&&e(T)});var E=l(b,2);g(E,17,()=>u(R),te,(e,t)=>{var n=se(),r=i(n),a=i(r);f(r);var s=l(r,2),c=i(s),d=i(c);f(c),f(s);var h=l(s,2),v=e=>{var n=ee();g(o(n),17,()=>u(t).markdownFiles,te,(e,t)=>{var n=ae(),r=i(n),a=i(r,!0);f(r);var o=l(r,2);ne(o,()=>u(t).content,!0),f(o),f(n),_(()=>x(a,u(t).filename)),w(e,n)}),w(e,n)},y=e=>{var n=oe(),r=i(n);f(n),_(()=>x(r,`No markdown artifacts found in PR #${u(t).number??``}.`)),w(e,n)};p(h,e=>{u(t).markdownFiles.length>0?e(v):e(y,-1)}),f(n),_(()=>{x(a,`PR #${u(t).number??``} Artifacts`),m(c,`href`,u(t).url),x(d,`View PR #${u(t).number??``} on GitHub`)}),w(e,n)});var D=l(E,2),O=e=>{w(e,ce())};p(D,e=>{u(R).length===0&&e(O)});var k=l(D,2),A=l(i(k),2),M=l(i(A),2);s(M),f(A);var N=l(A,2),P=i(N),I=e=>{var t=le(),n=i(t,!0);f(t),_(()=>{t.disabled=u(H),x(n,u(H)?`Processing...`:`Approve & Merge`)}),S(`click`,t,me),w(e,t)};p(P,e=>{u(R).length<=1&&e(I)});var z=l(P,2),B=l(z,2);f(N),f(k),_(e=>{x(c,`${u(L).title??``} `),x(h,`#${u(F)??``}`),x(y,`${u(C)??``}/${u(j)??``}`),M.disabled=u(H),z.disabled=e,B.disabled=u(H)},[()=>u(H)||!u(V).trim()]),re(M,()=>u(V),t=>e(V,t)),S(`click`,z,he),S(`click`,B,ge),w(t,n)};p(ve,e=>{u(z)?e(ye):u(B)?e(be,1):u(L)&&e(xe,2)}),f(Q),_(()=>m(_e,`href`,`${E??``}/approval`)),w(t,Q),y()}t([`click`]);export{F as component,j as universal};