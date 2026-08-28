"use client";
import { appAdminLogsLogsClientStyles as s } from "@/styles";
import { useEffect, useState } from "react";

type Log = { id:string; action:string; visibility:"STAFF"|"ADMIN_ONLY"; success:boolean; actorUsername:string; actorEmail:string; targetLabel:string|null; details:string|null; ipAddress:string|null; createdAt:string };
type Response = { logs:Log[]; total:number; page:number; pages:number };
const labels:Record<string,string> = {
  LOGIN:"Connexion", LOGOUT:"Déconnexion", USER_CREATED:"Compte créé", USER_DELETED:"Compte supprimé", ROLE_CHANGED:"Rôle modifié",
  PASSWORD_CHANGED:"Mot de passe modifié", PASSWORD_RESET:"Mot de passe réinitialisé", TOTP_CONFIGURED:"TOTP configuré", TOTP_RESET:"TOTP réinitialisé",
  NOTIFICATION_PREFERENCES_CHANGED:"Préférences de notification",
  TOTP_DISABLED:"TOTP désactivé", TOTP_ENABLED:"TOTP réactivé", VM_ASSIGNED:"VM attribuée", VM_UNASSIGNED:"Attribution retirée",
  VM_TAG_UPDATED:"Tag modifié", POWER_ON:"Démarrage", POWER_OFF:"Arrêt", VM_CREATED:"VM ajoutée", VM_DELETED:"VM supprimée",
  VM_SYNCED:"Synchronisation vCenter", VM_REFRESHED:"Inventaire actualisé", INFRASTRUCTURE_CHANGED:"Infrastructure modifiée",
  SITE_SETTINGS_CHANGED:"Configuration du site", SMTP_SETTINGS_CHANGED:"Configuration SMTP", VCENTER_SETTINGS_CHANGED:"Configuration vCenter",
};

export default function LogsClient({isAdmin}:{isAdmin:boolean}) {
  const [data,setData]=useState<Response|null>(null); const [page,setPage]=useState(1); const [loading,setLoading]=useState(true);
  useEffect(()=>{setLoading(true);fetch(`/api/logs?page=${page}`,{cache:"no-store"}).then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false))},[page]);
  return <div><div style={s.pageHeader}><div><h1 style={s.h1}>Journal global</h1><p style={s.sub}>{data?.total??0} événement(s)</p></div></div>
    <div style={{...s.card,overflowX:"auto"}}>{loading?<div style={s.empty}>Chargement…</div>:!data?.logs.length?<div style={s.empty}>Aucun événement</div>:
      <table style={{...s.table,minWidth:900}}><thead><tr><Th>Acteur</Th><Th>Action</Th><Th>Cible</Th><Th>Détails</Th>{isAdmin&&<Th>Portée</Th>}<Th>Statut</Th><Th>IP</Th><Th>Date</Th></tr></thead>
      <tbody>{data.logs.map(log=><tr key={log.id}><Td><strong>{log.actorUsername||"Système"}</strong><div style={{fontSize:11,color:"var(--text2)"}}>{log.actorEmail}</div></Td>
        <Td>{labels[log.action]??log.action}</Td><Td>{log.targetLabel??"—"}</Td><Td>{log.details??"—"}</Td>{isAdmin&&<Td>{log.visibility==="ADMIN_ONLY"?"Admin":"Staff"}</Td>}
        <Td><span style={log.success?s.badgeSuccess:s.badgeError}>{log.success?"Succès":"Échec"}</span></Td><Td>{log.ipAddress??"—"}</Td><Td style={{whiteSpace:"nowrap"}}>{new Date(log.createdAt).toLocaleString("fr-FR")}</Td></tr>)}</tbody></table>}</div>
    {data&&data.pages>1&&<div style={s.pagination}><button style={s.pageBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Précédent</button><span style={s.pageInfo}>Page {data.page} / {data.pages}</span><button style={s.pageBtn} onClick={()=>setPage(p=>Math.min(data.pages,p+1))} disabled={page===data.pages}>Suivant →</button></div>}
  </div>;
}
function Th({children}:{children:React.ReactNode}){return <th style={s.th}>{children}</th>}
function Td({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){return <td style={{...s.td,...style}}>{children}</td>}
