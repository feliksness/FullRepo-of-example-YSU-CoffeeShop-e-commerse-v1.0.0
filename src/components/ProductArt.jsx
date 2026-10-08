// Coffee Lab — generated product artwork (zero-cost, no external images).
// image_url values starting with "http" are shown as photos; "art:<category>" renders this SVG.
// Built by FeliksKhangeldyan
import { memo } from "react";

const C = {
  espresso: "#2b1d14", brown: "#5e3a24", mocha: "#8a5a3b", caramel: "#c8692a", latte: "#d8b48c",
  cream: "#f3e7d6", milk: "#fbf6ef", steel: "#9aa3a6", steelLight: "#d3d8da", copper: "#b8653a", glass: "#e8eef0", wood: "#9b6a43"
};
const ROAST = { light: "#c99a6b", "medium-light": "#a8714a", medium: "#8a5a3b", "medium-dark": "#5e3a24", dark: "#2b1d14" };
const SYRUP = { VAN: "#ead7a6", CAR: "#c8692a", HAZ: "#8a5a3b", CHO: "#3b2418", CIN: "#a6482a", SCA: "#d49a4a" };
const BG = ["#efe1cf", "#e9d6c0", "#f1e6d8", "#e6d3bd", "#ede0d0"];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function kindOf(p) {
  const s = p.sku || "";
  const has = (k) => s.includes(k);
  switch (p.category) {
    case "coffee-beans": return "pouch";
    case "ground-coffee": return "brick";
    case "instant-coffee": return has("3IN1") || has("SPC") ? "box" : "jar";
    case "syrups-addons": return s.startsWith("SY-") ? "syrup" : has("CAN") ? "box" : "pack";
    case "filters-consumables": return has("STL") ? "steelcone" : has("CLT") ? "cloth" : has("CLN") ? "box" : "paper";
    case "brewing-equipment":
      if (has("FRP")) return "press"; if (has("MOK")) return "moka"; if (has("DRP")) return "dripper"; if (has("SRV")) return "server";
      if (has("SCL")) return "scale"; if (has("GRD-ELC")) return "grinder"; if (has("GRD-HND")) return "handgrinder";
      if (has("KTL")) return "kettle"; if (has("CEZ")) return "cezve"; if (has("FRT")) return "frother"; return "press";
    case "accessories-storage":
      if (has("CNT")) return "canister"; if (has("JAR")) return "glassjar"; if (has("PIT")) return "pitcher"; if (has("SPN") || has("SCP")) return "spoon";
      if (has("CUP-RE")) return "takeaway"; if (has("CUP")) return "cup"; if (has("MUG")) return "mug"; if (has("BTL")) return "thermos";
      if (has("BRS")) return "brush"; if (has("TMP")) return "tamper"; if (has("WDT")) return "tool"; if (has("KNK")) return "knockbox";
      if (has("STD")) return "stand"; return "cup";
    default: return "pouch";
  }
}

const Bean = ({ x, y, r = 9, fill = C.espresso, rot = 30 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <ellipse rx={r * 0.72} ry={r} fill={fill} />
    <path d={`M0 ${-r * 0.85} C ${r * 0.35} ${-r * 0.3}, ${-r * 0.35} ${r * 0.3}, 0 ${r * 0.85}`} stroke={C.cream} strokeWidth="1.6" fill="none" opacity=".75" />
  </g>
);

function Shape({ kind, p, accent }) {
  const roast = ROAST[p.roast_level] || C.mocha;
  const label = (p.origin || "").split("·")[0].trim().toUpperCase().slice(0, 12);
  switch (kind) {
    case "pouch":
      return (<g>
        <path d="M58 52 L142 52 L150 168 Q100 176 50 168 Z" fill={roast} />
        <rect x="58" y="44" width="84" height="12" rx="3" fill={C.espresso} opacity=".85" />
        <rect x="64" y="92" width="72" height="50" rx="6" fill={C.cream} />
        <circle cx="128" cy="70" r="5" fill={C.espresso} opacity=".5" />
        <Bean x={84} y={110} r={8} fill={roast} />
        <text x="100" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="600" fill={C.espresso}>{label || "COFFEE"}</text>
        <rect x="96" y="104" width="32" height="4" rx="2" fill={accent} /><rect x="96" y="112" width="22" height="4" rx="2" fill={C.latte} />
      </g>);
    case "brick":
      return (<g>
        <path d="M60 60 L140 60 L146 70 L146 166 L54 166 L54 70 Z" fill={roast} />
        <path d="M60 60 L140 60 L146 70 L54 70 Z" fill={C.espresso} opacity=".35" />
        <rect x="62" y="96" width="76" height="46" rx="4" fill={C.cream} />
        {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={74 + i * 10} cy={110} r={2.2} fill={roast} />)}
        <text x="100" y="132" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="600" fill={C.espresso}>{(p.grind_type || "ground").toUpperCase().slice(0, 12)}</text>
        <rect x="62" y="150" width="76" height="6" rx="3" fill={accent} />
      </g>);
    case "jar":
      return (<g>
        <rect x="66" y="50" width="68" height="20" rx="5" fill={C.espresso} />
        <rect x="60" y="68" width="80" height="100" rx="14" fill={C.brown} />
        <rect x="68" y="98" width="64" height="40" rx="5" fill={C.cream} />
        <rect x="76" y="110" width="48" height="5" rx="2.5" fill={accent} /><rect x="76" y="120" width="32" height="5" rx="2.5" fill={C.latte} />
      </g>);
    case "box":
      return (<g>
        <path d="M54 76 L120 60 L150 76 L84 92 Z" fill={C.latte} />
        <path d="M54 76 L84 92 L84 166 L54 150 Z" fill={C.mocha} />
        <path d="M84 92 L150 76 L150 150 L84 166 Z" fill={C.caramel} />
        <rect x="98" y="104" width="38" height="24" rx="3" fill={C.cream} transform="skewY(-13) translate(0 24)" />
      </g>);
    case "syrup": {
      const col = SYRUP[(p.sku || "").slice(3, 6)] || C.caramel;
      return (<g>
        <rect x="94" y="30" width="12" height="20" fill={C.espresso} /><rect x="94" y="30" width="28" height="7" rx="2" fill={C.espresso} />
        <rect x="88" y="48" width="24" height="16" rx="3" fill={C.espresso} />
        <path d="M86 64 L114 64 L124 84 L124 168 Q100 174 76 168 L76 84 Z" fill={col} />
        <rect x="80" y="104" width="40" height="40" rx="4" fill={C.cream} />
        <rect x="88" y="116" width="24" height="4" rx="2" fill={col} /><rect x="88" y="124" width="16" height="4" rx="2" fill={C.latte} />
      </g>);
    }
    case "pack":
      return (<g>
        <path d="M62 58 Q100 50 138 58 L144 164 Q100 172 56 164 Z" fill={p.sku.includes("CHP") ? C.espresso : p.sku.includes("CRM") ? C.milk : C.latte} stroke={C.mocha} strokeWidth="2" />
        <path d="M62 58 Q100 50 138 58 L138 70 Q100 62 62 70 Z" fill={accent} />
        <rect x="72" y="100" width="56" height="34" rx="5" fill={C.cream} stroke={C.mocha} strokeWidth="1.5" />
        <circle cx="100" cy="117" r="8" fill={p.sku.includes("BRS") ? C.caramel : C.mocha} />
      </g>);
    case "paper":
      return (<g>
        {[0, 1, 2].map((i) => <path key={i} d={`M${50 + i * 6} ${70 + i * 10} L${150 - i * 6} ${70 + i * 10} L${112 - i * 3} ${160} L${88 + i * 3} ${160} Z`} fill={i === 2 ? C.milk : C.cream} stroke={C.latte} strokeWidth="2" />)}
        <path d="M70 94 L130 94" stroke={C.latte} strokeWidth="1.5" strokeDasharray="4 4" />
      </g>);
    case "steelcone":
      return (<g>
        <ellipse cx="100" cy="64" rx="52" ry="12" fill={C.steel} />
        <path d="M48 64 L152 64 L112 160 L88 160 Z" fill={C.steelLight} />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${60 + i * 4} ${80 + i * 16} L${140 - i * 4} ${80 + i * 16}`} stroke={C.steel} strokeWidth="1.5" />)}
        <rect x="150" y="60" width="18" height="8" rx="3" fill={C.espresso} />
      </g>);
    case "cloth":
      return (<g>
        <path d="M100 40 L100 70" stroke={C.wood} strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="100" cy="76" rx="46" ry="10" fill={C.steel} />
        <path d="M54 76 Q60 150 100 166 Q140 150 146 76 Z" fill={C.milk} stroke={C.latte} strokeWidth="2" />
        <path d="M70 100 Q100 112 130 100" stroke={C.latte} strokeWidth="2" fill="none" />
      </g>);
    case "press":
      return (<g>
        <rect x="96" y="30" width="8" height="26" fill={C.espresso} /><circle cx="100" cy="30" r="8" fill={C.espresso} />
        <rect x="66" y="56" width="68" height="10" rx="3" fill={C.steel} />
        <rect x="70" y="66" width="60" height="100" rx="6" fill={C.glass} stroke={C.steel} strokeWidth="3" />
        <rect x="74" y="106" width="52" height="56" rx="3" fill={C.brown} />
        <path d="M130 80 Q152 84 150 112 Q148 140 130 144" stroke={C.espresso} strokeWidth="8" fill="none" strokeLinecap="round" />
        <rect x="64" y="164" width="72" height="8" rx="3" fill={C.steel} />
      </g>);
    case "moka":
      return (<g>
        <path d="M76 52 L124 52 L132 104 L68 104 Z" fill={C.steel} />
        <path d="M100 40 L108 52 L92 52 Z" fill={C.espresso} />
        <rect x="64" y="102" width="72" height="8" rx="2" fill={C.espresso} />
        <path d="M68 110 L132 110 L140 168 L60 168 Z" fill={C.steelLight} />
        <path d="M132 62 Q160 66 150 98" stroke={C.espresso} strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M76 52 L66 46" stroke={C.steel} strokeWidth="6" strokeLinecap="round" />
      </g>);
    case "dripper":
      return (<g>
        <path d="M48 56 L152 56 L118 128 L82 128 Z" fill={C.milk} stroke={C.latte} strokeWidth="3" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${70 + i * 30} 64 L${92 + i * 8} 120`} stroke={C.latte} strokeWidth="2" />)}
        <rect x="72" y="128" width="56" height="10" rx="4" fill={C.milk} stroke={C.latte} strokeWidth="3" />
        <rect x="80" y="140" width="40" height="28" rx="6" fill={C.brown} opacity=".9" />
      </g>);
    case "server":
      return (<g>
        <path d="M70 52 L130 52 L136 100 Q140 168 100 168 Q60 168 64 100 Z" fill={C.glass} stroke={C.steel} strokeWidth="3" />
        <path d="M66 110 Q100 120 134 110 Q138 166 100 166 Q62 166 66 110 Z" fill={C.brown} />
        <path d="M130 66 Q156 70 150 100" stroke={C.wood} strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M70 52 L60 46" stroke={C.steel} strokeWidth="4" strokeLinecap="round" />
      </g>);
    case "scale":
      return (<g>
        <rect x="40" y="90" width="120" height="56" rx="12" fill={C.espresso} />
        <rect x="46" y="84" width="108" height="14" rx="6" fill={C.steel} />
        <rect x="64" y="110" width="72" height="22" rx="4" fill="#1d2a2c" />
        <text x="100" y="126" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="13" fill="#7fe0b5">18.0g</text>
      </g>);
    case "grinder":
      return (<g>
        <path d="M76 36 L124 36 L118 82 L82 82 Z" fill={C.glass} stroke={C.steel} strokeWidth="2" />
        <path d="M80 60 L120 60 L118 80 L82 80 Z" fill={C.brown} />
        <rect x="70" y="82" width="60" height="86" rx="10" fill={C.espresso} />
        <circle cx="100" cy="102" r="9" fill={C.steel} /><rect x="82" y="128" width="36" height="30" rx="4" fill={C.steelLight} />
      </g>);
    case "handgrinder":
      return (<g>
        <rect x="76" y="64" width="48" height="104" rx="10" fill={C.steelLight} stroke={C.steel} strokeWidth="2" />
        <rect x="76" y="110" width="48" height="16" fill={C.wood} />
        <path d="M100 64 L100 44 L146 44" stroke={C.espresso} strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="146" cy="44" r="9" fill={C.wood} />
      </g>);
    case "kettle":
      return (<g>
        <rect x="64" y="70" width="80" height="94" rx="14" fill={C.espresso} />
        <path d="M64 120 Q36 116 34 72" stroke={C.espresso} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M144 84 Q170 92 160 140" stroke={C.wood} strokeWidth="9" fill="none" strokeLinecap="round" />
        <ellipse cx="104" cy="70" rx="40" ry="8" fill={C.brown} /><circle cx="104" cy="60" r="7" fill={C.wood} />
      </g>);
    case "cezve":
      return (<g>
        <path d="M70 90 Q66 168 100 168 Q134 168 130 90 Z" fill={C.copper} />
        <ellipse cx="100" cy="90" rx="34" ry="8" fill="#d0844f" />
        <path d="M66 86 L58 80" stroke={C.copper} strokeWidth="6" strokeLinecap="round" />
        <path d="M130 100 L178 70" stroke={C.wood} strokeWidth="9" strokeLinecap="round" />
      </g>);
    case "frother":
      return (<g>
        <rect x="70" y="56" width="60" height="100" rx="14" fill={C.milk} stroke={C.steel} strokeWidth="3" />
        <path d="M130 80 Q154 84 150 120" stroke={C.espresso} strokeWidth="8" fill="none" strokeLinecap="round" />
        <rect x="62" y="156" width="76" height="12" rx="5" fill={C.espresso} />
        <circle cx="100" cy="72" r="5" fill={accent} />
      </g>);
    case "canister":
      return (<g>
        <rect x="62" y="56" width="76" height="16" rx="6" fill={C.espresso} /><circle cx="100" cy="56" r="10" fill={C.steel} />
        <rect x="60" y="70" width="80" height="98" rx="10" fill={C.steelLight} stroke={C.steel} strokeWidth="2" />
        <circle cx="100" cy="110" r="14" fill={C.espresso} /><path d="M100 98 L100 110 L108 114" stroke={C.cream} strokeWidth="2" fill="none" />
      </g>);
    case "glassjar":
      return (<g>
        <rect x="66" y="52" width="68" height="16" rx="4" fill={C.wood} />
        <rect x="62" y="66" width="76" height="102" rx="12" fill="#c58b4e" opacity=".55" />
        {[0, 1, 2, 3, 4, 5].map((i) => <Bean key={i} x={78 + (i % 3) * 22} y={120 + Math.floor(i / 3) * 24} r={8} fill={C.espresso} rot={i * 40} />)}
      </g>);
    case "pitcher":
      return (<g>
        <path d="M66 60 L136 60 L150 52 L140 70 L134 164 L72 164 Z" fill={C.steelLight} stroke={C.steel} strokeWidth="2" />
        <path d="M70 60 Q50 90 72 120" stroke={C.steel} strokeWidth="7" fill="none" />
        <path d="M76 100 L132 100" stroke={C.steel} strokeWidth="1.5" />
      </g>);
    case "spoon":
      return (<g>
        <ellipse cx="78" cy="110" rx="30" ry="22" fill={p.sku.includes("SCP") ? C.wood : C.steel} />
        <ellipse cx="78" cy="106" rx="22" ry="14" fill={C.brown} />
        <path d="M104 104 L170 70" stroke={p.sku.includes("SCP") ? C.wood : C.steel} strokeWidth="10" strokeLinecap="round" />
      </g>);
    case "takeaway":
      return (<g>
        <path d="M66 70 L134 70 L124 168 L76 168 Z" fill={accent} />
        <rect x="60" y="56" width="80" height="16" rx="5" fill={C.espresso} />
        <rect x="70" y="104" width="60" height="26" fill={C.cream} />
      </g>);
    case "cup":
      return (<g>
        <ellipse cx="100" cy="158" rx="58" ry="10" fill={C.latte} />
        <path d="M60 80 L140 80 Q138 150 100 150 Q62 150 60 80 Z" fill={C.milk} stroke={C.latte} strokeWidth="2" />
        <ellipse cx="100" cy="80" rx="40" ry="8" fill={C.brown} />
        <path d="M138 92 Q164 96 152 122 Q146 132 134 128" stroke={C.milk} strokeWidth="8" fill="none" />
      </g>);
    case "mug":
      return (<g>
        <rect x="70" y="50" width="60" height="118" rx="12" fill={accent} />
        <rect x="66" y="44" width="68" height="16" rx="5" fill={C.espresso} />
        <rect x="70" y="110" width="60" height="10" fill={C.cream} opacity=".8" />
      </g>);
    case "thermos":
      return (<g>
        <rect x="78" y="36" width="44" height="22" rx="6" fill={C.espresso} />
        <rect x="72" y="56" width="56" height="114" rx="14" fill={C.steelLight} stroke={C.steel} strokeWidth="2" />
        <rect x="72" y="96" width="56" height="34" fill={accent} />
      </g>);
    case "brush":
      return (<g>
        <path d="M60 140 L130 70" stroke={C.wood} strokeWidth="14" strokeLinecap="round" />
        <path d="M126 60 L150 40 M132 66 L158 50 M138 74 L164 60" stroke={C.espresso} strokeWidth="5" strokeLinecap="round" />
      </g>);
    case "tamper":
      return (<g>
        <path d="M84 40 Q100 30 116 40 L112 110 L88 110 Z" fill={C.wood} />
        <rect x="86" y="108" width="28" height="18" fill={C.steel} />
        <rect x="62" y="126" width="76" height="30" rx="6" fill={C.steelLight} stroke={C.steel} strokeWidth="2" />
      </g>);
    case "tool":
      return (<g>
        <circle cx="100" cy="88" r="40" fill={C.espresso} />
        <circle cx="100" cy="88" r="28" fill={C.steelLight} />
        <rect x="56" y="128" width="88" height="30" rx="6" fill={C.steel} />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${86 + i * 8} 158 L${86 + i * 8} 172`} stroke={C.steel} strokeWidth="2" />)}
      </g>);
    case "knockbox":
      return (<g>
        <path d="M56 80 L144 80 L136 166 L64 166 Z" fill={C.espresso} />
        <rect x="52" y="74" width="96" height="10" rx="4" fill={C.brown} />
        <rect x="56" y="92" width="88" height="10" rx="5" fill={C.steel} />
      </g>);
    case "stand":
      return (<g>
        <rect x="50" y="160" width="100" height="10" rx="4" fill={C.wood} />
        <rect x="134" y="62" width="8" height="100" fill={C.espresso} />
        <rect x="70" y="60" width="74" height="8" rx="3" fill={C.espresso} />
        <path d="M76 68 L124 68 L110 100 L90 100 Z" fill={C.milk} stroke={C.latte} strokeWidth="2" />
        <rect x="80" y="126" width="40" height="34" rx="6" fill={C.glass} stroke={C.steel} strokeWidth="2" />
      </g>);
    default:
      return <Bean x={100} y={100} r={40} />;
  }
}

function ProductArt({ product, className = "", size = "md" }) {
  if (product?.image_url && /^https?:\/\//i.test(product.image_url)) {
    return <img className={`product-art product-art--photo ${className}`} src={product.image_url} alt="" loading="lazy" />;
  }
  const h = hash(product?.sku || "x");
  const bg = BG[h % BG.length];
  const accent = [C.caramel, "#2f6f73", C.mocha, "#a6482a", "#6b7f3a"][h % 5];
  const kind = kindOf(product || {});
  return (
    <svg className={`product-art product-art--${size} ${className}`} viewBox="0 0 200 200" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect width="200" height="200" fill={bg} />
      <circle cx={40 + (h % 120)} cy={40 + ((h >> 3) % 60)} r="70" fill="#fff" opacity=".28" />
      <ellipse cx="100" cy="176" rx="62" ry="7" fill={C.espresso} opacity=".12" />
      <Shape kind={kind} p={product || {}} accent={accent} />
    </svg>
  );
}

export default memo(ProductArt);
