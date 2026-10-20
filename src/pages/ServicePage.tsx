export function ServicePage() {
  const operator = import.meta.env.VITE_OPERATOR_NAME
  const support = import.meta.env.VITE_SUPPORT_EMAIL
  const safeLink = (value: string | undefined) => { try { const url = new URL(value ?? ''); return url.protocol === 'https:' ? url.href : null } catch { return null } }
  const privacy = safeLink(import.meta.env.VITE_PRIVACY_URL), terms = safeLink(import.meta.env.VITE_TERMS_URL)
  return <section className="section"><div className="section-kicker">Pilot beta</div><h1>Service & support</h1>
    <p>VenueTwin creates editable, approximate venue models and seat previews. Review the model against your original materials before publishing. It does not certify measurements, accessible routes, safety or sightlines.</p>
    <h2>Access and usage</h2><p>Hosted Pilot access is granted by the operator. Analysis, planning and Blender builds have daily allowances. Automatic review reserves up to two AI request units. Failed or cancelled work can still consume allowance because processing may already have started. This version has no checkout or recurring billing.</p>
    <h2>What happens to your materials</h2><p>Uploaded reference files and draft reviews are saved in this browser. Analysing selected files sends them through the Pilot backend to OpenAI. Planning sends your brief, current layout and selected reference text. Blender receives the generated geometry blueprint. AI credentials stay on the server.</p>
    <p>Cloud projects use Supabase and are private to their owner unless sharing is enabled. Public preview links expose the venue layout to anyone with the link. Original uploads and GLB models are not automatically backed up with a cloud project. Export backups before clearing browser data.</p>
    <p>Hosted build files are temporary: they expire within about one hour, can be evicted after newer builds and are lost if the worker restarts. Download the model and viewer package after building. Support can disable Pilot access and handle cloud account deletion requests; browser data must also be cleared on your devices.</p>
    <h2>Contact</h2>{operator && support ? <p>{operator} · <a href={`mailto:${support}`}>{support}</a>. For failures, include the request ID if displayed. Do not send API keys or passwords.</p> : <p>Operator contact has not been configured. This installation is not ready for customer use.</p>}
    {privacy && <p><a href={privacy} rel="noreferrer">Privacy notice</a></p>}{terms && <p><a href={terms} rel="noreferrer">Service terms</a></p>}
  </section>
}
