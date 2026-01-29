# Resadex Design System Style Guide

This style guide outlines the design foundations and UI components for the **Resadex** landing page, a high-performance 3D-animated SaaS platform developed by the **FANCY Team**. The system emphasizes depth, motion, and a futuristic "Agentic AI" aesthetic.

## Aesthetic Vibe: 3D-Kinetic SaaS
The Resadex design system is defined as **3D-Kinetic SaaS** (or "Motion-First Fintech"). It merges the clean layout of modern B2B SaaS with immersive 3D spatial elements, glassmorphism, and fluid scrolling animations. The vibe is sophisticated, high-tech, and optimized for high conversion through visual storytelling.

## Visual Tokens

### Color Palette
The palette uses a high-contrast dark mode foundation with vibrant neon accents to highlight AI-driven interactions and financial data.

| Token | Role | Hex Code | Visual Description |
| :--- | :--- | :--- | :--- |
| **Primary** | Accent / CTA | `#A855F7` | Electric Purple (Vibrant AI-glow) |
| **Secondary** | Highlight | `#BBFF00` | Volt Green (High-visibility Fintech) |
| **Background** | Main Surface | `#0B0C10` | Obsidian Black (Deep spatial depth) |
| **Surface** | Card / Layer | `#1A1B23` | Dark Charcoal (Subtle elevation) |
| **Text-Primary** | Headings | `#FFFFFF` | Pure White (Max contrast) |
| **Text-Secondary**| Body | `#94A3B8` | Slate Grey (Reduced cognitive load) |

### Visual Effects
*   **Glassmorphism**: 15% opacity white borders with a `20px` backdrop blur.
*   **Depth**: Multi-layered z-index strategy to accommodate floating 3D assets.
*   **Glow**: Outer glows on active buttons using `0 0 20px rgba(168, 85, 247, 0.4)`.

## Typography
The typography system prioritizes readability amidst complex 3D backgrounds, utilizing variable fonts for smooth weight transitions during scroll animations.

*   **Primary Font Family**: `Outfit` (or `Plus Jakarta Sans`)
*   **Secondary Font Family**: `Inter` (System fallback for dense data)
*   **Type Scale**:
    *   **Display**: 72px / Bold (Hero titles with letter-spacing `-0.04em`)
    *   **Heading 1**: 48px / Semi-Bold
    *   **Heading 2**: 32px / Medium
    *   **Body**: 16px / Regular (Line height `1.6` for optimal readability)
    *   **Caption**: 12px / Medium / All-caps (For labels and micro-copy)

## Component Specs

### Buttons
*   **Primary Button**: Pill-shaped (`border-radius: 999px`), gradient background (Purple to Blue), internal padding `16px 32px`.
*   **Hover State**: Scale transform `1.05x` with an increase in drop-shadow intensity.
*   **Ghost Button**: White 1px border with a subtle background hover fill (`rgba(255, 255, 255, 0.05)`).

### Navigation
*   **Structure**: Centered pill-shaped floating nav or top-aligned sticky bar.
*   **Blur**: `backdrop-filter: blur(12px)` to maintain legibility over moving 3D assets.
*   **Items**: 14px Medium weight, 24px horizontal spacing, active state indicated by a subtle dot or glow.

### Cards
*   **Styling**: `24px` corner radius, `1px` border (Stroke: `#FFFFFF` at 10% opacity).
*   **Content**: Vertical layout with 3D icons centered or top-left aligned.
*   **Interaction**: Subtle lift on hover (`translateY(-8px)`) to simulate 3D interaction.

### 3D Assets & Icons
*   **Style**: High-gloss, matte-metallic textures (Claymorphism influenced).
*   **Animation**: Continuous slow-loop rotation (`Y-axis`) or parallax reacting to cursor movement.
*   **Integration**: Primarily used in the Hero section and feature breakdown cards to visualize AI "Agents."