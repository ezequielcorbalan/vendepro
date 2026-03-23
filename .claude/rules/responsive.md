# Responsive Rules

## Mobile-first modules (field work)
- Leads, activity, calendar, appraisals, contacts
- Default view: list/agenda (not grid/kanban)
- Filters in drawer/sheet
- Cards instead of tables
- Touch-friendly buttons (min 44px)
- No horizontal scroll

## Desktop-first modules (office work)
- Dashboards, reports, analytics, admin
- Can use wider grids, tables, side panels
- Filters inline or in sidebar

## Always verify
- Test both mobile and desktop after every change
- Grid columns: 1 on mobile, 2-3 on tablet, 4+ on desktop
- Text truncation with `truncate` or `line-clamp-*`
- Images with `object-cover` and fixed aspect ratios
