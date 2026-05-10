/**
 * v4.5 §25 — icon barrel shim.
 *
 * Single source for icon imports across the app. Initially re-exports from
 * `lucide-react` so existing call sites can migrate `import { Plus } from "lucide-react"`
 * to `import { Plus } from "@/lib/icons"` with a one-line search-and-replace.
 *
 * A later commit (v4.5 §26 commit 14) swaps the internals to Adobe Spectrum 2
 * icons (`@react-spectrum/s2/icons/*`). The barrel keeps the lucide-style names
 * as the public API so consumer files don't change a second time:
 *
 *   - lucide `X` → Spectrum `Cross`
 *   - lucide `Plus` → Spectrum `Add`
 *   - lucide `Trash2` → Spectrum `Delete`
 *   - lucide `RefreshCw` → Spectrum `Refresh`
 *   - lucide `AlertTriangle` → Spectrum `Alert`
 *   - lucide `Check` → Spectrum `Checkmark`
 *   - lucide `CheckCircle2` → Spectrum `CheckmarkCircle`
 *   - lucide `LayoutGrid` → Spectrum `ViewGrid`
 *   - lucide `List` → Spectrum `ViewList`
 *   - lucide `SlidersHorizontal` → Spectrum `Filter`
 *   - lucide `MoreHorizontal` → Spectrum `More`
 *   - (etc — see plan §25)
 *
 * For unmapped names (`Car`, `Megaphone`, `Wrench`, etc.) the barrel will
 * either inline a custom SVG or pull from Spectrum's workflow icon set.
 */

export {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Construction,
  Download,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Handshake,
  Hash,
  History,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  PoundSterling,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Type,
  Undo2,
  UserPlus,
  Wand2,
  Wrench,
  X,
} from "lucide-react";

export type { LucideIcon } from "lucide-react";
