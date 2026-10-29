#!/usr/bin/env python3
"""Generate distinct bundled product thumbnail SVGs for pantry items (offline-safe)."""
from __future__ import annotations

import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "thumbs")

# slug -> (primary, accent, label, vessel: bottle|jar|box|roll|pack|spray|stick|tub)
PRODUCTS: dict[str, tuple[str, str, str, str]] = {
    "three-crabs-fish-sauce": ("#8B1A1A", "#F5E6C8", "3C", "bottle"),
    "dettol-disinfectant": ("#006B3F", "#E8F5E9", "Dt", "bottle"),
    "omo-detergent": ("#1E56A0", "#E3F2FD", "OMO", "box"),
    "kleenex-toilet-paper": ("#0288D1", "#E1F5FE", "Kx", "pack"),
    "listerine-mouthwash": ("#004D40", "#E0F2F1", "Li", "bottle"),
    "mitchum-deodorant": ("#37474F", "#ECEFF1", "Mi", "stick"),
    "dettol-laundry-sanitiser": ("#2E7D32", "#E8F5E9", "Dt", "bottle"),
    "dettol-wipes": ("#388E3C", "#E8F5E9", "Dt", "pack"),
    "glad-bake-paper": ("#F9A825", "#FFF8E1", "Gd", "roll"),
    "glad-foil": ("#78909C", "#ECEFF1", "Gd", "roll"),
    "energizer-batteries": ("#FF6F00", "#FFF3E0", "En", "pack"),
    "moro-olive-oil": ("#33691E", "#F1F8E9", "Mo", "bottle"),
    "colavita-olive-oil": ("#1B5E20", "#E8F5E9", "Co", "bottle"),
    "spiral-tamari": ("#5D4037", "#EFEBE9", "Sp", "bottle"),
    "bertolli-spray": ("#558B2F", "#F1F8E9", "Be", "spray"),
    "mazzetti-balsamic": ("#4A148C", "#F3E5F5", "Mz", "bottle"),
    "queen-vanilla": ("#6A1B9A", "#F3E5F5", "Qu", "tub"),
    "chung-jung-ssamjang": ("#C62828", "#FFEBEE", "CJ", "tub"),
    "capriccio-anchovy": ("#1565C0", "#E3F2FD", "Ca", "jar"),
    "maeil-doenjang": ("#E65100", "#FFF3E0", "Ma", "tub"),
    "lee-kum-kee-chilli-oil": ("#B71C1C", "#FFEBEE", "LK", "jar"),
    "koala-eco-bleach": ("#00838F", "#E0F7FA", "Ko", "bottle"),
    "la-espanola-olive-oil": ("#2E7D32", "#E8F5E9", "LE", "bottle"),
    "finish-rinse-aid": ("#0277BD", "#E1F5FE", "Fi", "bottle"),
    "finish-quantum-tablets": ("#01579B", "#E1F5FE", "Fi", "box"),
    "sorbent-tissues": ("#0288D1", "#E1F5FE", "So", "pack"),
    "morning-fresh-dishwashing": ("#00897B", "#E0F2F1", "MF", "bottle"),
    "palmolive-hand-wash": ("#00838F", "#E0F7FA", "Pa", "bottle"),
    "ajax-spray-wipe": ("#1976D2", "#E3F2FD", "Aj", "spray"),
    "pine-o-cleen": ("#2E7D32", "#E8F5E9", "PO", "bottle"),
    "quilton-paper-towel": ("#1565C0", "#E3F2FD", "Qu", "roll"),
    "glad-chux-superwipes": ("#F9A825", "#FFF8E1", "Gd", "pack"),
    "bosistos-eucalyptus": ("#00695C", "#E0F2F1", "Bo", "spray"),
    "mortein-surface-spray": ("#D84315", "#FBE9E7", "Mo", "spray"),
    "white-king-bleach": ("#0277BD", "#E1F5FE", "WK", "bottle"),
    "handee-paper-towel": ("#3949AB", "#E8EAF6", "Ha", "roll"),
    "aerogard-odourless": ("#006064", "#E0F7FA", "Ae", "spray"),
}


def vessel_path(kind: str) -> str:
    if kind == "bottle":
        return (
            '<rect x="14" y="8" width="20" height="6" rx="2" fill="{accent}"/>'
            '<path d="M16 14h16v22c0 2-1.5 4-4 4H20c-2.5 0-4-2-4-4V14z" fill="{primary}"/>'
            '<rect x="19" y="18" width="10" height="12" rx="1" fill="{accent}" opacity="0.35"/>'
        )
    if kind == "jar":
        return (
            '<rect x="15" y="10" width="18" height="5" rx="2" fill="{accent}"/>'
            '<rect x="14" y="15" width="20" height="24" rx="4" fill="{primary}"/>'
            '<rect x="17" y="19" width="14" height="10" rx="2" fill="{accent}" opacity="0.3"/>'
        )
    if kind == "box":
        return (
            '<rect x="12" y="14" width="24" height="22" rx="3" fill="{primary}"/>'
            '<rect x="14" y="16" width="20" height="8" rx="1" fill="{accent}" opacity="0.45"/>'
            '<rect x="14" y="26" width="20" height="3" rx="1" fill="{accent}" opacity="0.25"/>'
        )
    if kind == "roll":
        return (
            '<ellipse cx="24" cy="28" rx="14" ry="10" fill="{primary}"/>'
            '<ellipse cx="24" cy="26" rx="10" ry="7" fill="{accent}" opacity="0.4"/>'
            '<rect x="22" y="8" width="4" height="14" rx="1" fill="{accent}"/>'
        )
    if kind == "pack":
        return (
            '<rect x="13" y="12" width="22" height="26" rx="4" fill="{primary}"/>'
            '<rect x="16" y="16" width="16" height="10" rx="2" fill="{accent}" opacity="0.4"/>'
            '<circle cx="24" cy="32" r="3" fill="{accent}" opacity="0.5"/>'
        )
    if kind == "spray":
        return (
            '<rect x="20" y="6" width="8" height="8" rx="2" fill="{accent}"/>'
            '<path d="M18 14h12l-2 24c0 2-2 4-4 4h-4c-2 0-4-2-4-4L18 14z" fill="{primary}"/>'
        )
    if kind == "stick":
        return (
            '<rect x="20" y="8" width="8" height="6" rx="2" fill="{accent}"/>'
            '<rect x="19" y="14" width="10" height="24" rx="5" fill="{primary}"/>'
        )
    if kind == "tub":
        return (
            '<ellipse cx="24" cy="34" rx="13" ry="6" fill="{primary}"/>'
            '<rect x="11" y="16" width="26" height="18" rx="6" fill="{primary}"/>'
            '<rect x="14" y="19" width="20" height="8" rx="2" fill="{accent}" opacity="0.35"/>'
        )
    return vessel_path("bottle")


def svg_for(slug: str, primary: str, accent: str, label: str, vessel: str) -> str:
    body = vessel_path(vessel).format(primary=primary, accent=accent)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect width="48" height="48" rx="8" fill="#FFFFFF"/>
  <rect x="0.5" y="0.5" width="47" height="47" rx="7.5" fill="none" stroke="#E8E2D9"/>
  {body}
  <text x="24" y="44" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="{primary}">{label}</text>
</svg>
"""


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for slug, (primary, accent, label, vessel) in PRODUCTS.items():
        path = os.path.join(OUT, f"{slug}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg_for(slug, primary, accent, label, vessel))
    print(f"Wrote {len(PRODUCTS)} thumbnails to {OUT}")


if __name__ == "__main__":
    main()
