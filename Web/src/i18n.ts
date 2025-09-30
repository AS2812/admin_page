// src/i18n.ts
export type Lang = 'en' | 'ar';

let lang: Lang = (localStorage.getItem('lang') as Lang) || 'en';

const res = {
  en: {
    brand: 'SpotnSend',

    nav: {
      dashboard: 'Dashboard',
      incident: 'Incidents',
      complaints: 'Complaints',
      map: 'Map',
      users: 'Users',
    },

    // Dashboard sections
    kpi: {
      reportsToday: 'Reports Today',
      openReports: 'Open Reports',
      resolved: 'Resolved',
      avgResponse: 'Avg. Response(min)',
    },
    sections: {
      trend: '7-day Incidents Trend',
      recent: 'Recent Reports',
      mapPreview: 'Map Preview',
      details: 'Report Details',
    },
    details: { severityCategory: 'Severity / Category' },

    // Generic table labels
    table: {
      id: 'ID',
      title: 'Subject',
      area: 'Area',
      severity: 'Severity',
      status: 'Status',
      reportedAt: 'Reported at',
    },

    // Incidents page text + filters
    incident: {
      search: { placeholder: 'Search by Status or ID' },
      filters: {
        status: 'Status',
        severity: 'Severity',
        dateRange: 'Date Range',
      },
      status: {
        submitted: 'Submitted',
        assigned: 'Assigned',
        resolved: 'Resolved',
      },
      severity: {
        low: 'Low',
        normal: 'Normal',
      },
    },

    // Complaints
    complaints: { category: 'Category' },

    // Categories used for complaints & map
    categories: {
      infrastructure: 'Infrastructure',
      road: 'Road',
      electric: 'Electric',
      sanitation: 'Sanitation',
    },

    // Map page (filters + legend)
    map: {
      filters: {
        type: 'Type',
        sc: 'Severity / Category',
      },
      type: {
       all: 'Incidents & Complaints',
       incident: 'Incidents',
       complaint: 'Complaints',
      },
      legend: {
        severity: 'Severity',
        category: 'Category',
      },
    },

    // Actions (dashboard right card)
    actions: { assign: 'Assign', resolve: 'Resolve', note: 'Add Note' },

    // Days (dashboard chart)
    days: ['SUN','MON','TUE','WED','THU','FRI','SAT'],
    
    users: {
      search: { placeholder: "Search by name or ID" },
      filters: { role: "Role", status: "Status", active: "Active" },
      columns: { name: "Name", id: "ID", role: "Role", status: "Status", active: "Active", action: "Action" },
      // Add to res.en.users:
      actions: {
      details: "Details",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirmDelete: "Confirm Delete",
      verify: "Verify",
      unverify: "Unverify",
      ban: "Ban",
      unban: "Unban",
      addNew: "Add New",
      create: "Create"
     },
      details: {
      title: "User Details",
      name: "Name",
      nationalIdNumber: "National ID Number",
      nationalIdImages: "National ID Photos",
      gender: "Gender",
      phone: "Phone",
      radius: "Notification Radius (km)",
      favourites: "Favourited Spots",
      email: "Email",
      reports: "Reports Submitted"
    }
    },
    
  },

  ar: {
    brand: 'SpotnSend',

    nav: {
      dashboard: 'لوحة التحكم',
      incident: 'البلاغات',
      complaints: 'الشكاوى',
      map: 'الخريطة',
      users: 'المستخدمون',
    },

    kpi: {
      reportsToday: 'بلاغات اليوم',
      openReports: 'البلاغات المفتوحة',
      resolved: 'تم الحل',
      avgResponse: 'متوسط الاستجابة(دقيقة)',
    },
    sections: {
      trend: 'اتجاه البلاغات خلال 7 أيام',
      recent: 'آخر البلاغات',
      mapPreview: 'معاينة الخريطة',
      details: 'تفاصيل البلاغ',
    },
    details: { severityCategory: 'الخطورة / الفئة' },

    table: {
      id: 'المعرّف',
      title: 'الموضوع',
      area: 'المنطقة',
      severity: 'الخطورة',
      status: 'الحالة',
      reportedAt: 'وقت الإبلاغ',
    },

    incident: {
      search: { placeholder: 'ابحث بالحالة أو المعرّف' },
      filters: {
        status: 'الحالة',
        severity: 'الخطورة',
        dateRange: 'الفترة',
      },
      status: {
        submitted: 'مقدّم',
        assigned: 'مسند',
        resolved: 'محلول',
      },
      severity: {
        low: 'منخفض',
        normal: 'عادي',
      },
    },

    complaints: { category: 'الفئة' },

    categories: {
      infrastructure: 'البنية التحتية',
      road: 'الطريق',
      electric: 'كهرباء',
      sanitation: 'نظافة',
    },

    map: {
      filters: {
        type: 'النوع',
        sc: 'الخطورة / الفئة',
      },
      type: {
        all: 'البلاغات والحوادث',
        incident: 'البلاغات',
        complaint: 'الشكاوى',
      },
      legend: {
        severity: 'الخطورة',
        category: 'الفئة',
      },
    },

    actions: { assign: 'إسناد', resolve: 'حلّ', note: 'إضافة ملاحظة' },
    days: ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
    users: {
      search: { placeholder: "ابحث بالاسم أو المعرّف" },
      filters: { role: "الدور", status: "الحالة", active: "نشِط" },
      columns: { name: "الاسم", id: "المعرّف", role: "الدور", status: "الحالة", active: "نشِط", action: "إجراء" },
      actions: {
       details: "تفاصيل",
       edit: "تعديل",
       save: "حفظ",
       cancel: "إلغاء",
       delete: "حذف",
       confirmDelete: "تأكيد الحذف",
       verify: "توثيق",
       unverify: "إلغاء التوثيق",
       ban: "حظر",
       unban: "إلغاء الحظر",
       addNew: "إضافة جديد",
       create: "إنشاء"
     },
      details: {
       title: "تفاصيل المستخدم",
       name: "الاسم",
       nationalIdNumber: "الرقم القومي",
       nationalIdImages: "صور البطاقة",
       gender: "النوع",
       phone: "رقم الهاتف",
       radius: "نطاق الإشعارات (كم)",
       favourites: "المواقع المفضلة",
       email: "البريد الإلكتروني",
       reports: "عدد البلاغات"
}
  },
  },
} as const;

export function t(key: string): string {
  const parts = key.split('.');
  // @ts-ignore
  let node: any = res[lang];
  for (const p of parts) { node = node?.[p]; if (node == null) return key; }
  return String(node);
}
export function getLang(): Lang { return lang; }

/** set language WITHOUT flipping layout; also set data-lang for CSS */
export function setLang(L: Lang): void {
  lang = L;
  localStorage.setItem('lang', L);
  document.documentElement.setAttribute('data-lang', L);
  window.dispatchEvent(new CustomEvent('i18n:change', { detail: L }));
}

/* initial */
document.documentElement.dir = 'ltr';
document.documentElement.setAttribute('data-lang', lang);

