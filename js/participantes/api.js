const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScW7ZZ6IhQBWmkjaawyRBb_ocDqFBMIiUxL6_cGNmzvEiPEpg/formResponse';
const ENTRY_RA = 'entry.1408214994';
const ENTRY_APELIDO = 'entry.964858180';

export async function enviarInscricao(ra, apelido) {
  const formData = new URLSearchParams();
  formData.append(ENTRY_RA, ra);
  formData.append(ENTRY_APELIDO, apelido);

  await fetch(FORM_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
}