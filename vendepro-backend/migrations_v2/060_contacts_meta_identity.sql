-- 060_contacts_meta_identity.sql
-- Identidad de Meta en los contactos, para el inbox de Instagram y Facebook.
--
-- El problema que resuelve: Instagram NO da el teléfono de la persona. Da un
-- IGSID (id interno de Meta, estable por página) y, con una llamada aparte, el
-- usuario de Instagram. Como todo el CRM engancha por teléfono, un DM entrante
-- no se puede cruzar con nadie: sin esto, la misma persona que ya existe por
-- WhatsApp entra como contacto nuevo cada vez que escribe por Instagram.
--
-- `meta_user_id` es la clave real (el IGSID/PSID); `ig_username` es para que el
-- agente sepa con quién habla. La unificación de duplicados —cuando el cliente
-- pasa su teléfono y resulta que ya estaba en la base— se resuelve aparte y a
-- mano: fusionar contactos a ciegas es de las cosas que más daño hacen en un
-- CRM.

ALTER TABLE contacts ADD COLUMN meta_user_id TEXT;
ALTER TABLE contacts ADD COLUMN ig_username TEXT;

-- Reconocer al que vuelve a escribir. No es UNIQUE a propósito: el mismo IGSID
-- puede repetirse entre organizaciones distintas (es por página), y una fila
-- duplicada dentro de una org no debe romper la ingesta de un mensaje.
CREATE INDEX IF NOT EXISTS idx_contacts_meta_user ON contacts(org_id, meta_user_id);
