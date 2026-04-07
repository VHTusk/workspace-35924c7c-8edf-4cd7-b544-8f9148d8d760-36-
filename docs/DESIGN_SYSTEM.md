# VALORHIVE Design System

## 1. Color System

### Sport-Specific Themes
Use the `theme-{sport}` class on a parent element to apply sport-specific CSS variables:

```tsx
// In layout
<div className="theme-cornhole">...</div>
<div className="theme-darts">...</div>
```

### Using CSS Variables
Instead of hardcoded colors, use semantic CSS variables:

| Variable | Usage | Example |
|----------|-------|---------|
| `--primary` | Primary action color | Buttons, links |
| `--primary-foreground` | Text on primary | Button text |
| `--background` | Page background | Main containers |
| `--foreground` | Primary text | Headings, body text |
| `--muted` | Secondary backgrounds | Cards, sections |
| `--muted-foreground` | Secondary text | Descriptions, labels |
| `--card` | Card backgrounds | Card components |
| `--border` | Border color | Dividers, borders |
| `--sport-primary` | Sport-specific primary | Dynamic elements |
| `--sport-accent` | Sport accent | Highlights |

### Using useSportStyling Hook
```tsx
import { useSportStyling } from "@/hooks/use-sport-styling";

function MyComponent() {
  const { classes, theme, isCornhole } = useSportStyling();
  
  return (
    <div className={classes.primaryBgSubtle}>
      <span className={classes.primaryText}>Sport-colored text</span>
      <button className={classes.primaryBtn}>Action</button>
    </div>
  );
}
```

## 2. Typography Scale

### Headings
```css
h1: text-3xl sm:text-4xl font-bold     /* Page titles */
h2: text-2xl sm:text-3xl font-bold     /* Section titles */
h3: text-xl sm:text-2xl font-semibold  /* Card titles */
h4: text-lg font-semibold              /* Subsections */
h5: text-base font-semibold            /* Labels */
h6: text-sm font-semibold              /* Small labels */
```

### Body Text
```css
text-base    /* Primary body text */
text-sm      /* Secondary text, descriptions */
text-xs      /* Labels, captions, metadata */
```

### Responsive Font Sizes
Always use responsive prefixes for headings:
```tsx
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">
```

## 3. Spacing System

### Container Padding
```css
Page container: p-4 md:p-6
Section container: py-8 sm:py-12 lg:py-16
```

### Card Padding (Standardized)
| Type | Padding | Usage |
|------|---------|-------|
| Standard | `p-4` | List items, compact cards |
| Featured | `p-6` | Hero cards, feature cards |
| Compact | `p-3` | Dense lists, inline cards |

### Section Spacing
```css
Vertical section gap: space-y-6 or space-y-8
Grid gap: gap-4 (tight) / gap-6 (standard)
```

## 4. Icon Sizes

### Standardized Sizes
| Size | Tailwind Class | Usage |
|------|---------------|-------|
| xs | `w-3 h-3` | Inline with small text |
| sm | `w-4 h-4` | Inline with text, badges |
| md | `w-5 h-5` | Buttons, list items (DEFAULT) |
| lg | `w-6 h-6` | Feature icons, nav icons |
| xl | `w-8 h-8` | Hero icons, stats |
| 2xl | `w-10 h-10` | Empty states |
| 3xl | `w-12 h-12` | Large feature icons |

### Usage Examples
```tsx
// Inline with text
<span className="text-sm"><Icon className="w-3.5 h-3.5 mr-1" /> Label</span>

// Button icon
<Button><Icon className="w-5 h-5 mr-2" /> Action</Button>

// Feature card icon
<div className="w-12 h-12 rounded-xl bg-primary/10">
  <Icon className="w-6 h-6" />
</div>

// Empty state icon
<Icon className="w-10 h-10 text-muted-foreground" />
```

## 5. Border Radius

### Standardized Values
| Type | Tailwind Class | Usage |
|------|---------------|-------|
| Small | `rounded-lg` | Buttons, inputs, badges |
| Default | `rounded-xl` | Cards, modals (from --radius) |
| Large | `rounded-2xl` | Feature cards, hero sections |
| Full | `rounded-full` | Avatars, pills, dots |

## 6. Shadows

### Standardized Shadows
| Type | Tailwind Class | Usage |
|------|---------------|-------|
| Subtle | `shadow-sm` | Default cards |
| Medium | `shadow-md` | Hovered cards |
| Large | `shadow-lg` | Elevated elements |
| XL | `shadow-xl` | Modals, dropdowns |

### Design System Classes (from globals.css)
```tsx
<div className="card-subtle">    // Light shadow
<div className="card-elevated">  // Elevated shadow
<div className="glow-sport">     // Sport-colored glow
```

## 7. Component Patterns

### Card Component
```tsx
<Card className="border-border bg-card hover:shadow-md transition-shadow">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg font-semibold">Title</CardTitle>
  </CardHeader>
  <CardContent className="p-4">
    {/* Content */}
  </CardContent>
</Card>
```

### Stat Card
```tsx
<Card className="bg-card border-border">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  </CardContent>
</Card>
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="relative mb-4">
    <div className="p-4 rounded-full bg-muted/50">
      <Icon className="w-10 h-10 text-muted-foreground" />
    </div>
  </div>
  <h3 className="font-semibold text-foreground mb-1">{title}</h3>
  <p className="text-sm text-muted-foreground mb-4 max-w-xs">{description}</p>
  <Link href={actionHref}>
    <Button className={classes.primaryBtn}>
      {actionLabel}
      <ChevronRight className="w-4 h-4 ml-1" />
    </Button>
  </Link>
</div>
```

## 8. Dark Mode

### Using Dark Mode Variants
Always include dark mode variants for custom colors:
```tsx
// Good
<div className="bg-green-100 dark:bg-green-900/30">
  <span className="text-green-700 dark:text-green-300">
  
// Better (using semantic colors)
<div className="bg-muted">
  <span className="text-muted-foreground">
```

### Theme-Aware Color Classes
```tsx
// Sport-specific colors (automatically switch for dark mode)
<span className={classes.primaryText}>Sport-colored text</span>
<div className={classes.primaryBgSubtle}>Sport-colored background</div>
```

## 9. Responsive Breakpoints

### Tailwind Breakpoints
| Breakpoint | Width | Usage |
|------------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablets |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |
| 2xl | 1536px | Extra large |

### Common Patterns
```tsx
// Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// Responsive text
<h1 className="text-2xl sm:text-3xl lg:text-4xl">

// Hide/show on breakpoints
<div className="hidden md:block">
<div className="block md:hidden">

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
```

## 10. Accessibility

### Skip-to-Content Link
Already implemented in root layout. Use `id="main-content"` on main elements.

### Icon-Only Buttons
Always provide aria-labels:
```tsx
<Button variant="ghost" size="icon" aria-label="Previous slide">
  <ChevronLeft className="w-5 h-5" />
</Button>
```

### Focus States
Use focus-visible for keyboard navigation:
```tsx
<button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
```

## 11. Shared Utilities

### Tournament Colors
Import from `/lib/tournament-colors.ts`:
```tsx
import { getScopeColor, getStatusColor, getSportColors } from "@/lib/tournament-colors";

const scopeClasses = getScopeColor("CITY");
const statusClasses = getStatusColor("REGISTRATION_OPEN");
const sportClasses = getSportColors("cornhole");
```

### Tournament Status
Use from `/lib/tournament-status.ts`:
```tsx
import { getTournamentStatusInfo, getDetailedTournamentStatus } from "@/lib/tournament-status";

const statusInfo = getTournamentStatusInfo("live");
// statusInfo.bgClass, statusInfo.textClass, statusInfo.borderClass
```
