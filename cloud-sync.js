(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const status = msg => {if($('cloudStatus'))$('cloudStatus').textContent=msg};
 const cfg=window.RT_FIREBASE_CONFIG||{};
 if(!cfg.apiKey||!cfg.projectId||!cfg.appId){status('尚未啟用 Firebase：練習會儲存在本機，老師暫時看不到跨裝置紀錄。');return;}
 if(!window.firebase){status('無法載入 Firebase，請檢查網路連線。');return;}
 let app,auth,db,uid=null,code='';
 try{app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();}
 catch(e){status('Firebase 初始化失敗：'+e.message);return;}
 const localKey='rt_kindness_practice_v3';
 const formatCode=s=>String(s||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
 const validCode=s=>/^[A-Z0-9]{12}$/.test(s);
 const alias=()=>String($('studentName')?.value||'').trim().slice(0,30);
 const safeAttempt=a=>({timestamp:String(a.timestamp||''),scene:Number(a.scene)||0,line:Number(a.line)||0,role:String(a.role||'').slice(0,50),text:String(a.text||'').slice(0,500),kind:String(a.kind||'').slice(0,45),recognized:String(a.recognized||'').slice(0,500),unmatched:Array.isArray(a.unmatched)?a.unmatched.filter(x=>typeof x==='string').slice(0,80):[],expectedWords:a.expectedWords==null?null:Number(a.expectedWords),matchedWords:a.matchedWords==null?null:Number(a.matchedWords),teacherDuration:a.teacherDuration==null?null:Number(a.teacherDuration),studentUploadDuration:a.studentUploadDuration==null?null:Number(a.studentUploadDuration),recognitionElapsed:a.recognitionElapsed==null?null:Number(a.recognitionElapsed)});
 async function syncAttempt(a){if(!uid||!code) return;const id=String(a.id||'');if(!/^[A-Za-z0-9-]{4,100}$/.test(id))return;await db.collection('classes').doc(code).collection('students').doc(uid).collection('attempts').doc(id).set(safeAttempt(a));}
 async function syncAll(){if(!uid||!code)return;const records=JSON.parse(localStorage.getItem(localKey)||'[]');let sent=0,failed=0;for(const a of records){try{await syncAttempt(a);sent++}catch(e){failed++;console.warn('sync failed',e)}}status(failed?`已同步 ${sent} 筆，另有 ${failed} 筆失敗；請檢查網路或安全規則。`:`已加入班級 ${code}，完成同步 ${sent} 筆練習紀錄。`);}
 async function join(raw){const requested=formatCode(raw);if(!validCode(requested)){status('請輸入老師提供的 12 碼班級代碼。');return;}if(!alias()){status('請先在「發音練習紀錄」輸入學生代號（不要輸入全名）。');$('studentName')?.focus();return;}
 status('正在連接班級與同步紀錄……');$('joinClass').disabled=true;
 try{const user=auth.currentUser|| (await auth.signInAnonymously()).user;uid=user.uid;
 const cls=await db.collection('classes').doc(requested).get();if(!cls.exists)throw Error('找不到班級代碼。');
 code=requested;
 await db.collection('classes').doc(code).collection('students').doc(uid).set({alias:alias(),lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
 localStorage.setItem('rt_cloud_class',code);await syncAll();}
 catch(e){code='';status('無法加入班級：'+e.message)}finally{$('joinClass').disabled=false;}}
 $('joinClass').onclick=()=>join($('classCode').value);
 $('studentName')?.addEventListener('change',async()=>{if(code&&uid&&alias()){try{await db.collection('classes').doc(code).collection('students').doc(uid).set({alias:alias(),lastSeen:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})}catch(e){status('更新代號失敗：'+e.message)}}});
 window.addEventListener('rt-attempt-saved',async ev=>{if(!code||!uid)return;try{await syncAttempt(ev.detail);status('新練習已同步至老師後台。')}catch(e){status('這次紀錄已存本機，雲端同步失敗：'+e.message)}});
 // 有些裝置會自動還原匿名登入；沒有學生代號時不自動上傳。
 const saved=localStorage.getItem('rt_cloud_class');if(validCode(saved)){$('classCode').value=saved;auth.onAuthStateChanged(u=>{if(u&&alias()&&!code)join(saved)})}
})();