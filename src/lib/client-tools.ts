import { registerToolRenderers, registerTools } from "@agentictrust/ui";

export function describeCurrentPage(pathname: string): string {
  if (pathname === "/") return "Dashboard with KPI overview, AI insights, pipeline funnel, and recent activity";
  if (pathname === "/contacts") return "Contacts list with search, status filter, and engagement indicators";
  if (pathname.startsWith("/contacts/")) return `Contact detail page with engagement score, deals, and activity timeline`;
  if (pathname === "/deals") return "Deals list with stage filter, health indicators, and days-in-stage tracking";
  if (pathname === "/pipeline") return "Visual Kanban board showing deals as cards organized by stage with drag-and-drop";
  if (pathname === "/activities") return "Activity log with type filters for calls, emails, meetings, and notes";
  return "Nexus CRM page";
}

function resolveNavigationPath(args: Record<string, unknown>): string {
  if (typeof args.path === "string" && args.path.trim()) return args.path;
  if (typeof args.url === "string" && args.url.trim()) {
    try {
      const parsed = new URL(args.url, window.location.origin);
      return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return args.url;
    }
  }
  return "/";
}

export function registerClientSideTools(navigateFn: (path: string) => void): void {
  const navigateTool = async (args: Record<string, unknown>) => {
    const path = resolveNavigationPath(args);
    navigateFn(path);
    return { success: true, navigated_to: path };
  };

  const tools = {
    navigate: navigateTool,
    navigate_to: async (args: Record<string, unknown>) => {
      const path = resolveNavigationPath(args);
      navigateFn(path);
      return { success: true, navigated_to: path };
    },

    open_new_contact_form: async () => {
      window.dispatchEvent(new CustomEvent("crm:open-modal", { detail: { type: "contact" } }));
      return { success: true };
    },

    open_new_deal_form: async () => {
      window.dispatchEvent(new CustomEvent("crm:open-modal", { detail: { type: "deal" } }));
      return { success: true };
    },

    show_pipeline: async () => {
      navigateFn("/pipeline");
      return { success: true, navigated_to: "/pipeline" };
    },

    get_current_page: async () => {
      return {
        pathname: window.location.pathname,
        title: document.title,
        url: window.location.href,
      };
    },
  };

  registerTools(tools);
  if (window.AgenticTrust) {
    window.AgenticTrust.registerTools(tools);
  }

  const renderers = {
    list_contacts: () => ({ text: "Searching contacts..." }),
    get_contact: () => ({ text: "Loading contact details..." }),
    create_contact: () => ({ text: "Creating new contact..." }),
    update_contact: () => ({ text: "Updating contact..." }),
    delete_contact: () => ({ text: "Deleting contact..." }),
    list_deals: () => ({ text: "Loading deals..." }),
    create_deal: () => ({ text: "Creating new deal..." }),
    update_deal: () => ({ text: "Updating deal stage..." }),
    delete_deal: () => ({ text: "Deleting deal..." }),
    list_activities: () => ({ text: "Loading activities..." }),
    log_activity: () => ({ text: "Logging activity..." }),
    get_dashboard_stats: () => ({ text: "Pulling dashboard stats..." }),
    search_crm: () => ({ text: "Searching across CRM..." }),
    get_insights: () => ({ text: "Analyzing your pipeline..." }),
    get_contact_engagement: () => ({ text: "Computing engagement score..." }),
    get_pipeline_health: () => ({ text: "Checking pipeline health..." }),
    get_stale_deals: () => ({ text: "Finding stale deals..." }),
    suggest_next_action: () => ({ text: "Thinking about next steps..." }),
  };

  registerToolRenderers(renderers);
  if (window.AgenticTrust) {
    window.AgenticTrust.registerToolRenderers(renderers);
  }
}
