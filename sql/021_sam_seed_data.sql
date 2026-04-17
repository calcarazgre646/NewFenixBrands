-- ============================================================================
-- 009_sam_seed_data.sql — Datos iniciales del Motor de Marketing (SAM)
--
-- Ejecutar en AUTH DB DESPUÉS de 008_sam_tables.sql.
-- Crea los 9 triggers pre-configurados + templates base.
-- El equipo de marketing NO necesita crear estos manualmente.
-- ============================================================================

-- ─── Templates base (uno por canal) ─────────────────────────────────────────

INSERT INTO sam_templates (id, name, channel, subject, body) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Reactivación WhatsApp',
   'whatsapp',
   NULL,
   'Hola {{razon_social}} 👋 Te extrañamos en Fénix! Hace tiempo que no nos visitás. Tenemos novedades en Martel, Wrangler y Lee que te van a encantar. ¿Te esperamos?'),

  ('00000000-0000-0000-0000-000000000002',
   'Bienvenida Email',
   'email',
   'Bienvenido/a a Fénix Brands ✨',
   'Hola {{razon_social}},

Gracias por tu primera compra con nosotros.

En Fénix Brands trabajamos con las mejores marcas: Martel, Wrangler y Lee.

Tu código de cliente es {{erp_code}}. Cualquier consulta, estamos para ayudarte.

Saludos,
El equipo Fénix'),

  ('00000000-0000-0000-0000-000000000003',
   'Oferta SMS',
   'sms',
   NULL,
   'Fenix: {{razon_social}}, tenemos una oferta especial para vos. Visitanos y llevate lo mejor de Martel, Wrangler y Lee.'),

  ('00000000-0000-0000-0000-000000000004',
   'Agradecimiento Compra Alta',
   'email',
   'Gracias por tu compra, {{razon_social}} 🎉',
   'Hola {{razon_social}},

Queremos agradecerte por tu compra. Clientes como vos son muy importantes para nosotros.

Como cliente {{tier}}, tenés beneficios exclusivos. Seguí disfrutando de lo mejor de Martel, Wrangler y Lee.

El equipo Fénix'),

  ('00000000-0000-0000-0000-000000000005',
   'Recordatorio Pago',
   'whatsapp',
   NULL,
   'Hola {{razon_social}}, te recordamos que tenés un saldo pendiente de {{total_spent}}. Contactanos para regularizar tu cuenta y seguir disfrutando de nuestros productos. Gracias!'),

  ('00000000-0000-0000-0000-000000000006',
   'Seguimiento Post-Compra',
   'email',
   '¿Cómo te fue con tu compra?',
   'Hola {{razon_social}},

Hace unos días realizaste una compra con nosotros. ¿Todo bien con tus productos?

Si tenés alguna consulta o necesitás algo, estamos para ayudarte.

Saludos,
El equipo Fénix'),

  ('00000000-0000-0000-0000-000000000007',
   'Incentivo Segunda Compra',
   'whatsapp',
   NULL,
   'Hola {{razon_social}}! 🔥 Ya conocés la calidad de Fénix. Volvé a visitarnos, tenemos nuevas colecciones de Martel, Wrangler y Lee esperándote.'),

  ('00000000-0000-0000-0000-000000000008',
   'Recuperación Ticket Bajo',
   'sms',
   NULL,
   'Fenix: {{razon_social}}, tenemos promos especiales en las marcas que más te gustan. Aprovechalas! Visitanos.'),

  ('00000000-0000-0000-0000-000000000009',
   'Seguimiento Devolución',
   'email',
   'Queremos saber cómo podemos mejorar',
   'Hola {{razon_social}},

Notamos que realizaste una devolución recientemente. Nos importa tu experiencia y queremos asegurarnos de que todo esté bien.

¿Hubo algún problema con el producto? Contanos para poder ayudarte mejor la próxima vez.

El equipo Fénix')

ON CONFLICT (id) DO NOTHING;

-- ─── 9 Triggers pre-configurados (las reglas del negocio) ───────────────────

INSERT INTO sam_triggers (name, category, description, channel, template_id, conditions, frequency_cap, priority, is_active) VALUES
  ('Reactivación por inactividad',
   'inactivity',
   'Contactar clientes que no compran hace más de 90 días para reactivar la relación comercial',
   'whatsapp',
   '00000000-0000-0000-0000-000000000001',
   '{"inactivityDays": 90}',
   7, 1, true),

  ('Cobranza pendiente',
   'overdue',
   'Recordatorio amigable a clientes con facturas vencidas pendientes de pago',
   'whatsapp',
   '00000000-0000-0000-0000-000000000005',
   '{}',
   14, 2, true),

  ('Seguimiento post-compra',
   'post_purchase',
   'Contacto de satisfacción 7 días después de cada compra',
   'email',
   '00000000-0000-0000-0000-000000000006',
   '{"withinDays": 7}',
   30, 3, true),

  ('Bienvenida primera compra',
   'first_purchase',
   'Mensaje de bienvenida automático al cliente que compra por primera vez',
   'email',
   '00000000-0000-0000-0000-000000000002',
   '{}',
   365, 4, true),

  ('Incentivo segunda compra',
   'second_purchase',
   'Impulsar la segunda compra del cliente para consolidar la relación',
   'whatsapp',
   '00000000-0000-0000-0000-000000000007',
   '{}',
   30, 5, true),

  ('Reconocimiento ticket alto',
   'high_ticket',
   'Agradecimiento personalizado por compras de alto valor (>Gs. 500.000)',
   'email',
   '00000000-0000-0000-0000-000000000004',
   '{"ticketThreshold": 500000}',
   30, 6, true),

  ('Recuperación ticket bajo',
   'low_ticket',
   'Oferta para incentivar mayor gasto en clientes con ticket bajo',
   'sms',
   '00000000-0000-0000-0000-000000000008',
   '{"ticketThreshold": 500000}',
   14, 7, true),

  ('Alerta stock bajo',
   'low_stock',
   'Notificar a clientes cuando productos de su interés tienen stock bajo',
   'whatsapp',
   '00000000-0000-0000-0000-000000000001',
   '{"stockThreshold": 10}',
   7, 8, false),

  ('Seguimiento devolución',
   'return',
   'Contactar clientes que realizaron devoluciones para entender el problema y retener la relación',
   'email',
   '00000000-0000-0000-0000-000000000009',
   '{}',
   30, 9, true);
