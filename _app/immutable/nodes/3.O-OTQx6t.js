import{A as e,B as t,F as n,I as r,J as i,L as a,R as o,T as s,V as c,X as l,_ as u,c as d,d as f,g as p,h as m,j as h,q as g,r as _,v,x as y,y as b,z as x}from"../chunks/BPPyitxZ.js";import{c as S}from"../chunks/BBKqv4QJ.js";import"../chunks/v_jBEYI6.js";import{a as C,r as w}from"../chunks/6mRxH2fI.js";var T=y(`<p>Loading approval queue...</p>`),E=y(`<p class="error svelte-sv3efk"> </p>`),D=y(`<p>No items currently in Human Review.</p>`),O=y(`<tr><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"><a class="view-link svelte-sv3efk">View & Approve</a></td></tr>`),k=y(`<a class="mobile-item-link svelte-sv3efk"><div class="list-item svelte-sv3efk"><div class="avatar-col svelte-sv3efk"><img class="author-avatar svelte-sv3efk"/></div> <div class="content-col svelte-sv3efk"><div class="item-header svelte-sv3efk"><span class="repo-name svelte-sv3efk"> </span> <span class="time-stamp svelte-sv3efk"> </span></div> <div class="item-subject svelte-sv3efk"> </div> <div class="item-snippet svelte-sv3efk"> </div> <div class="item-footer svelte-sv3efk"><span class="issue-number svelte-sv3efk"> </span></div></div></div></a>`),A=y(`<div class="desktop-view svelte-sv3efk"><table class="svelte-sv3efk"><thead><tr><th class="svelte-sv3efk">Issue</th><th class="svelte-sv3efk">Repository</th><th class="svelte-sv3efk">Title</th><th class="svelte-sv3efk">Action</th></tr></thead><tbody></tbody></table></div> <div class="mobile-view svelte-sv3efk"></div>`,1),j=y(`<div class="container svelte-sv3efk"><nav class="svelte-sv3efk"><a class="svelte-sv3efk">← Back to Dashboard</a></nav> <h1 class="svelte-sv3efk">Approval Queue</h1> <!></div>`);function M(y,M){i(M,!0);let N=c(x([])),P=c(!0),F=c(null);_(async()=>{let e=w();if(!e){C();return}try{let n=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
			query ProjectItems($org: String!, $number: Int!) {
				organization(login: $org) {
					projectV2(number: $number) {
						items(first: 100) {
							nodes {
								id
								status: fieldValueByName(name: "Status") {
									... on ProjectV2ItemFieldSingleSelectValue {
										name
										optionId
									}
								}
								content {
									... on Issue {
										number
										title
										updatedAt
										bodyText
										author {
											login
											avatarUrl
										}
										repository {
											nameWithOwner
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
		`,variables:{org:`LLM-Orchestration`,number:1}})})).json();if(n.errors)throw Error(n.errors[0].message);let r=n.data.organization.projectV2.items.nodes;t(N,r.filter(e=>e.status?.optionId===`0fd775be`&&e.content?.number),!0)}catch(e){console.error(e),t(F,e instanceof Error?e.message:String(e),!0)}finally{t(P,!1)}});function I(e){let t=new Date(e),n=Math.floor((new Date().getTime()-t.getTime())/1e3);return n<60?`just now`:n<3600?`${Math.floor(n/60)}m ago`:n<86400?`${Math.floor(n/3600)}h ago`:n<604800?`${Math.floor(n/86400)}d ago`:t.toLocaleDateString(void 0,{month:`short`,day:`numeric`})}var L=j();f(`sv3efk`,t=>{e(()=>{n.title=`Approval Queue - Conductor`})});var R=r(L),z=r(R);l(R);var B=o(R,4),V=e=>{b(e,T())},H=e=>{var t=E(),n=r(t,!0);l(t),h(()=>v(n,s(F))),b(e,t)},U=e=>{b(e,D())},W=e=>{var t=A(),n=a(t),i=r(n),c=o(r(i));m(c,21,()=>s(N),p,(e,t)=>{var n=O(),i=r(n),a=r(i);l(i);var c=o(i),u=r(c,!0);l(c);var f=o(c),p=r(f,!0);l(f);var m=o(f),g=r(m);l(m),l(n),h(()=>{v(a,`#${s(t).content.number??``}`),v(u,s(t).content.repository.nameWithOwner),v(p,s(t).content.title),d(g,`href`,`${S??``}/approval/${s(t).content.repository.owner.login??``}/${s(t).content.repository.name??``}/${s(t).content.number??``}?itemId=${s(t).id??``}`)}),b(e,n)}),l(c),l(i),l(n);var u=o(n,2);m(u,21,()=>s(N),p,(e,t)=>{var n=k(),i=r(n),a=r(i),c=r(a);l(a);var u=o(a,2),f=r(u),p=r(f),m=r(p,!0);l(p);var g=o(p,2),_=r(g,!0);l(g),l(f);var y=o(f,2),x=r(y,!0);l(y);var C=o(y,2),w=r(C,!0);l(C);var T=o(C,2),E=r(T),D=r(E);l(E),l(T),l(u),l(i),l(n),h(e=>{d(n,`href`,`${S??``}/approval/${s(t).content.repository.owner.login??``}/${s(t).content.repository.name??``}/${s(t).content.number??``}?itemId=${s(t).id??``}`),d(c,`src`,s(t).content.author.avatarUrl),d(c,`alt`,s(t).content.author.login),v(m,s(t).content.repository.nameWithOwner),v(_,e),v(x,s(t).content.title),v(w,s(t).content.bodyText),v(D,`#${s(t).content.number??``}`)},[()=>I(s(t).content.updatedAt)]),b(e,n)}),l(u),b(e,t)};u(B,e=>{s(P)?e(V):s(F)?e(H,1):s(N).length===0?e(U,2):e(W,-1)}),l(L),h(()=>d(z,`href`,`${S??``}/`)),b(y,L),g()}export{M as component};