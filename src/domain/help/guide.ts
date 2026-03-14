/**
 * domain/help/guide.ts
 *
 * Contenido de la guía de usuario. Puro, testeable, sin dependencias de React.
 * Cada sección mapea a una página del dashboard con su descripción,
 * features clave, y el permiso requerido para verla.
 */
import type { Permissions } from "@/domain/auth/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuideFeature {
  title: string;
  description: string;
}

export interface GuideSection {
  id: string;
  title: string;
  path: string;
  icon: string; // emoji para simplicidad en domain puro
  summary: string;
  features: GuideFeature[];
  tips: string[];
  /** Predicado: ¿el usuario puede ver esta sección? */
  allowed: (p: Permissions) => boolean;
}

// ─── Guide Content ───────────────────────────────────────────────────────────

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "inicio",
    title: "Inicio",
    path: "/",
    icon: "bolt",
    summary:
      "Resumen ejecutivo con el progreso hacia la meta anual. Muestra ventas acumuladas, presupuesto, forecast y comparación interanual.",
    features: [
      {
        title: "Meta Anual",
        description:
          "Gauge visual que muestra el porcentaje de cumplimiento del presupuesto acumulado.",
      },
      {
        title: "Gráfico Mensual",
        description:
          "Evolución mes a mes de ventas reales vs presupuesto vs año anterior.",
      },
      {
        title: "Diagnóstico Automático",
        description:
          "Barra de insights que analiza el rendimiento por marca y canal automáticamente.",
      },
      {
        title: "Tabla de Performance",
        description:
          "Desglose mensual con montos, cumplimiento % y variación interanual.",
      },
    ],
    tips: [
      "Usá los filtros de marca y canal para aislar el rendimiento de una línea específica.",
      "El indicador de frescura de datos muestra cuándo se actualizó la información por última vez.",
    ],
    allowed: (p) => p.canViewExecutive,
  },
  {
    id: "ventas",
    title: "Ventas",
    path: "/ventas",
    icon: "dollar",
    summary:
      "Dashboard analítico de ventas con desglose por marca, canal, tienda y SKU. Incluye métricas de margen y ticket promedio.",
    features: [
      {
        title: "Métricas Principales",
        description:
          "Ventas netas, cumplimiento presupuesto, crecimiento interanual y margen bruto en cards destacadas.",
      },
      {
        title: "Desglose por Marca",
        description:
          "Gráfico de barras con la participación de cada marca en las ventas totales.",
      },
      {
        title: "Mix de Canales",
        description:
          "Distribución porcentual entre B2C (retail) y B2B (mayoristas).",
      },
      {
        title: "Top SKUs",
        description:
          "Ranking de los productos más vendidos con volumen y participación.",
      },
      {
        title: "Tabla de Tiendas",
        description:
          "Métricas por punto de venta. Hacé click en una tienda para filtrar todo el dashboard.",
      },
      {
        title: "Comportamiento Semanal",
        description:
          "Patrón de ventas por día de la semana para identificar picos de demanda.",
      },
    ],
    tips: [
      "Seleccioná una tienda en la tabla para ver su rendimiento individual.",
      "El margen bruto cambia de color según su salud: verde (>50%), amarillo (40-50%), rojo (<40%).",
    ],
    allowed: (p) => p.canViewSales,
  },
  {
    id: "acciones",
    title: "Centro de Acciones",
    path: "/acciones",
    icon: "list",
    summary:
      "Cola de acciones priorizadas por un algoritmo waterfall. Identifica qué productos reponer, en qué tiendas y con qué urgencia.",
    features: [
      {
        title: "Algoritmo Waterfall",
        description:
          "Clasifica acciones en 4 niveles: Pareto (80/20), Crítico (sin stock), Stock Bajo y Sobrestock.",
      },
      {
        title: "Vista por Tienda",
        description:
          "Agrupa acciones por punto de venta mostrando cluster (A/B/OUT) y horario operativo.",
      },
      {
        title: "Vista por Marca",
        description:
          "Agrupa acciones por marca para ver el impacto total por línea de producto.",
      },
      {
        title: "Filtro Pareto",
        description:
          "Activá el filtro 80/20 para enfocarte solo en los SKUs que representan el 80% de la venta.",
      },
    ],
    tips: [
      "Las acciones se cargan con un proceso transparente que muestra el progreso en tiempo real.",
      "Combiná el filtro Pareto con la vista por tienda para priorizar reposiciones.",
    ],
    allowed: (p) => p.canViewActions,
  },
  {
    id: "logistica",
    title: "Logística / ETAs",
    path: "/logistica",
    icon: "ship",
    summary:
      "Pipeline de importaciones con estado, ETAs y composición por marca. Seguí el recorrido de cada orden desde origen hasta depósito.",
    features: [
      {
        title: "Estado de Órdenes",
        description:
          "Contadores de órdenes activas, en tránsito, por ingresar y completadas.",
      },
      {
        title: "Pipeline por Marca",
        description:
          "Cards visuales con el estado de la cadena de suministro de cada marca.",
      },
      {
        title: "Origen de Importaciones",
        description:
          "Distribución porcentual por país/región de origen.",
      },
      {
        title: "Tabla de Órdenes",
        description:
          "Detalle de cada orden agrupada por estado. Expandí una orden para ver SKUs, cantidades y ETAs.",
      },
    ],
    tips: [
      "Usá el toggle Activos/Todos para filtrar órdenes ya completadas.",
      "Expandí las secciones por estado para ver el detalle de cada orden.",
    ],
    allowed: (p) => p.canViewLogistics,
  },
  {
    id: "depositos",
    title: "Depósitos",
    path: "/depositos",
    icon: "warehouse",
    summary:
      "Análisis de la red de depósitos con cobertura de inventario, rotación y salud de nodos centrales y tiendas dependientes.",
    features: [
      {
        title: "KPIs de Red",
        description:
          "Cobertura %, unidades en red, disponibilidad de stock, rotación y score de salud.",
      },
      {
        title: "Barra de Salud",
        description:
          "Distribución visual de riesgo: verde (saludable), amarillo (en riesgo), rojo (crítico).",
      },
      {
        title: "Nodos Centrales",
        description:
          "STOCK (depósito central) y RETAILS (colectivo de tiendas) con sus métricas independientes.",
      },
      {
        title: "Tiendas Dependientes",
        description:
          "Acordeón expandible por tienda con SKUs, cantidades, días de cobertura y rotación.",
      },
      {
        title: "Top SKUs de Red",
        description:
          "Tabla de los productos con mayor rotación en toda la red de distribución.",
      },
    ],
    tips: [
      "Los días de cobertura indican cuántos días de venta cubre el inventario actual.",
      "Un score de salud bajo indica que la tienda necesita reposición pronto.",
    ],
    allowed: (p) => p.canViewDepots,
  },
  {
    id: "kpis",
    title: "KPIs",
    path: "/kpis",
    icon: "bolt",
    summary:
      "Catálogo de 50 indicadores de gestión organizados en 9 categorías. 9 KPIs core disponibles con datos en vivo y sparklines.",
    features: [
      {
        title: "KPIs Disponibles",
        description:
          "9 indicadores core con valor actual, sparkline de tendencia y badge de variación interanual.",
      },
      {
        title: "9 Categorías",
        description:
          "Ventas, Márgenes, Eficiencia, Cliente, Logística, Depósitos, Rentabilidad, Crecimiento y SKU/Assortment.",
      },
      {
        title: "Vista por Categoría",
        description:
          "Entrá a cada categoría para ver todos sus KPIs con filtro por estado (disponible, próximo, pendiente).",
      },
      {
        title: "Indicadores Bloqueados",
        description:
          "Los KPIs pendientes aparecen en gris con badge de fase. Se activarán en futuras versiones.",
      },
    ],
    tips: [
      "El color del sparkline indica la tendencia: verde (mejorando), rojo (empeorando).",
      "Hacé click en 'Ver todos' en cada categoría para explorar los KPIs en detalle.",
    ],
    allowed: (p) => p.canViewKpis,
  },
  {
    id: "calendario",
    title: "Calendario",
    path: "/calendario",
    icon: "calendar",
    summary:
      "Calendario compartido para planificar eventos, campañas y deadlines. Incluye presupuesto por evento y sincronización en tiempo real.",
    features: [
      {
        title: "Vistas Múltiples",
        description:
          "Mes, semana, día y año completo. Cada vista muestra los eventos con su color de categoría.",
      },
      {
        title: "CRUD de Eventos",
        description:
          "Creá, editá y eliminá eventos con título, fechas, categoría, descripción y presupuesto.",
      },
      {
        title: "Presupuesto",
        description:
          "Asigná un monto en Guaraníes o Dólares a cada evento para trazabilidad financiera.",
      },
      {
        title: "Categorías Personalizables",
        description:
          "Creá categorías con colores personalizados. Editá el color en cualquier momento.",
      },
      {
        title: "Drag & Drop",
        description:
          "Arrastrá eventos para cambiar su fecha. Redimensioná para ajustar duración.",
      },
    ],
    tips: [
      "Hacé click en un día vacío para crear un evento rápidamente.",
      "Los cambios se sincronizan en tiempo real entre todos los usuarios conectados.",
    ],
    allowed: (p) => p.canViewCalendar,
  },
  {
    id: "usuarios",
    title: "Usuarios",
    path: "/usuarios",
    icon: "group",
    summary:
      "Gestión de cuentas de usuario: crear, editar roles, asignar canales y activar/desactivar accesos.",
    features: [
      {
        title: "Crear Usuario",
        description:
          "Registrá nuevos usuarios con email, nombre, rol y canal asignado. Reciben contraseña temporal.",
      },
      {
        title: "Editar Perfil",
        description:
          "Cambiá rol, canal, cargo y estado activo/inactivo de cualquier usuario (excepto el propio).",
      },
      {
        title: "Roles del Sistema",
        description:
          "Super User (acceso total + gestión), Gerencia (acceso total sin gestión), Negocio (acceso limitado por canal).",
      },
      {
        title: "Filtros",
        description:
          "Filtrá la tabla por rol y por estado para encontrar usuarios rápidamente.",
      },
    ],
    tips: [
      "Los nuevos usuarios deben cambiar su contraseña en el primer inicio de sesión.",
      "No podés cambiar tu propio rol ni desactivar tu propia cuenta (protección anti-bloqueo).",
    ],
    allowed: (p) => p.canManageUsers,
  },
];

// ─── Filtering ───────────────────────────────────────────────────────────────

/** Filtra las secciones de la guía según los permisos del usuario */
export function getVisibleSections(permissions: Permissions): GuideSection[] {
  return GUIDE_SECTIONS.filter((section) => section.allowed(permissions));
}

/** Busca una sección por ID */
export function findSection(id: string): GuideSection | undefined {
  return GUIDE_SECTIONS.find((s) => s.id === id);
}
