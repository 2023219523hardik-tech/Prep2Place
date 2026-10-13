"use client";

import React from "react";

export interface CompanyBrandMeta {
  displayName: string;
  category: "Big Tech" | "FinTech" | "Enterprise" | "Consumer Tech" | "Indian Tech";
  accentColor: string;
  badgeGlow: string;
  tagline: string;
}

export const COMPANY_BRAND_DIRECTORY: Record<string, CompanyBrandMeta> = {
  google: {
    displayName: "Google",
    category: "Big Tech",
    accentColor: "#4285F4",
    badgeGlow: "rgba(66, 133, 244, 0.2)",
    tagline: "Algorithms, Distributed Systems & AI",
  },
  amazon: {
    displayName: "Amazon",
    category: "Big Tech",
    accentColor: "#FF9900",
    badgeGlow: "rgba(255, 153, 0, 0.2)",
    tagline: "High-Scale E-Commerce, AWS & Low-Latency Systems",
  },
  microsoft: {
    displayName: "Microsoft",
    category: "Big Tech",
    accentColor: "#00A4EF",
    badgeGlow: "rgba(0, 164, 239, 0.2)",
    tagline: "Azure Cloud, System Design & Core CS",
  },
  apple: {
    displayName: "Apple",
    category: "Big Tech",
    accentColor: "#A2AAAD",
    badgeGlow: "rgba(162, 170, 173, 0.2)",
    tagline: "Hardware-Software Co-Design, iOS & Systems",
  },
  meta: {
    displayName: "Meta",
    category: "Big Tech",
    accentColor: "#0668E1",
    badgeGlow: "rgba(6, 104, 225, 0.2)",
    tagline: "High-Throughput Social Graph & Infrastructure",
  },
  netflix: {
    displayName: "Netflix",
    category: "Big Tech",
    accentColor: "#E50914",
    badgeGlow: "rgba(229, 9, 20, 0.2)",
    tagline: "Streaming Architecture & Resilient Microservices",
  },
  uber: {
    displayName: "Uber",
    category: "Consumer Tech",
    accentColor: "#000000",
    badgeGlow: "rgba(0, 0, 0, 0.2)",
    tagline: "Real-Time Geospatial Routing & Dispatch Systems",
  },
  adobe: {
    displayName: "Adobe",
    category: "Enterprise",
    accentColor: "#FF0000",
    badgeGlow: "rgba(255, 0, 0, 0.2)",
    tagline: "Computer Graphics, Creative Cloud & Compilers",
  },
  bloomberg: {
    displayName: "Bloomberg",
    category: "FinTech",
    accentColor: "#4361EE",
    badgeGlow: "rgba(67, 97, 238, 0.2)",
    tagline: "Real-Time Market Data, C++ & Low-Latency Networks",
  },
  "goldman-sachs": {
    displayName: "Goldman Sachs",
    category: "FinTech",
    accentColor: "#1E395B",
    badgeGlow: "rgba(30, 57, 91, 0.2)",
    tagline: "Algorithmic Trading & High-Frequency Systems",
  },
  "american-express": {
    displayName: "American Express",
    category: "FinTech",
    accentColor: "#006FCF",
    badgeGlow: "rgba(0, 111, 207, 0.2)",
    tagline: "Secure Global Payment Gateways & Fraud Detection",
  },
  oracle: {
    displayName: "Oracle",
    category: "Enterprise",
    accentColor: "#F80000",
    badgeGlow: "rgba(248, 0, 0, 0.2)",
    tagline: "Enterprise Database Internals & Cloud Infrastructure",
  },
  salesforce: {
    displayName: "Salesforce",
    category: "Enterprise",
    accentColor: "#00A1E0",
    badgeGlow: "rgba(0, 161, 224, 0.2)",
    tagline: "Multi-Tenant Enterprise SaaS & Data Clouds",
  },
  bytedance: {
    displayName: "ByteDance",
    category: "Consumer Tech",
    accentColor: "#20D5EC",
    badgeGlow: "rgba(32, 213, 236, 0.2)",
    tagline: "AI Recommendation Engines & Video Streaming",
  },
  cisco: {
    displayName: "Cisco",
    category: "Enterprise",
    accentColor: "#1BA0D7",
    badgeGlow: "rgba(27, 160, 215, 0.2)",
    tagline: "Computer Networks, Routing Protocols & Security",
  },
  atlassian: {
    displayName: "Atlassian",
    category: "Enterprise",
    accentColor: "#0052CC",
    badgeGlow: "rgba(0, 82, 204, 0.2)",
    tagline: "Developer Collaboration & Distributed Cloud Services",
  },
  nvidia: {
    displayName: "NVIDIA",
    category: "Big Tech",
    accentColor: "#76B900",
    badgeGlow: "rgba(118, 185, 0, 0.2)",
    tagline: "Parallel Computing, CUDA & Deep Learning Platforms",
  },
  stripe: {
    displayName: "Stripe",
    category: "FinTech",
    accentColor: "#635BFF",
    badgeGlow: "rgba(99, 91, 255, 0.2)",
    tagline: "Global Financial Infrastructure & API Excellence",
  },
  flipkart: {
    displayName: "Flipkart",
    category: "Indian Tech",
    accentColor: "#2874F0",
    badgeGlow: "rgba(40, 116, 240, 0.2)",
    tagline: "E-Commerce Supply Chain, Warehouse Robotics & Flash Sales",
  },
  swiggy: {
    displayName: "Swiggy",
    category: "Indian Tech",
    accentColor: "#FC8019",
    badgeGlow: "rgba(252, 128, 25, 0.2)",
    tagline: "Hyperlocal Logistics, Dynamic ETA & Batch Routing",
  },
  zomato: {
    displayName: "Zomato",
    category: "Indian Tech",
    accentColor: "#E23744",
    badgeGlow: "rgba(226, 55, 68, 0.2)",
    tagline: "High-Concurrency Consumer Ordering & Fleet Routing",
  },
  tcs: {
    displayName: "Tata Consultancy Services",
    category: "Indian Tech",
    accentColor: "#00539F",
    badgeGlow: "rgba(0, 83, 159, 0.2)",
    tagline: "Global Enterprise Transformation & Digital Engineering",
  },
  infosys: {
    displayName: "Infosys",
    category: "Indian Tech",
    accentColor: "#007CC3",
    badgeGlow: "rgba(0, 124, 195, 0.2)",
    tagline: "Next-Gen Digital Services & Cloud Integration",
  },
  morganstanley: {
    displayName: "Morgan Stanley",
    category: "FinTech",
    accentColor: "#002D62",
    badgeGlow: "rgba(0, 45, 98, 0.2)",
    tagline: "Quantitative Modeling & Risk Management Systems",
  },
  jpmorgan: {
    displayName: "JPMorgan Chase",
    category: "FinTech",
    accentColor: "#0A2540",
    badgeGlow: "rgba(10, 37, 64, 0.2)",
    tagline: "Investment Banking Tech & Financial Transaction Networks",
  },
};

export function getCompanyMeta(slug: string): CompanyBrandMeta {
  const normalized = slug.toLowerCase().trim();
  if (COMPANY_BRAND_DIRECTORY[normalized]) {
    return COMPANY_BRAND_DIRECTORY[normalized];
  }
  // Title case fallback
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    displayName: title,
    category: "Enterprise",
    accentColor: "#4F46E5",
    badgeGlow: "rgba(79, 70, 229, 0.2)",
    tagline: "Core Data Structures & Algorithm Challenges",
  };
}

export function CompanyLogo({ slug, name: _name, className = "w-7 h-7" }: { slug: string; name?: string; className?: string }) {
  const normalized = slug.toLowerCase().trim();

  switch (normalized) {
    case "google":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Google">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.27 21.37 7.34 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.26C.46 8.19 0 9.99 0 12s.46 3.81 1.26 5.41l4.02-3.09z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.63 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
          />
        </svg>
      );

    case "microsoft":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Microsoft">
          <rect x="1" y="1" width="10" height="10" fill="#F25022" rx="1.5" />
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00" rx="1.5" />
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF" rx="1.5" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" rx="1.5" />
        </svg>
      );

    case "amazon":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Amazon">
          <path
            fill="#FF9900"
            d="M13.9 15.5c-3.1 2.3-7.6 3.5-11.5 1.5-.5-.3-1 .2-.6.7 2.4 2.8 6.5 4.3 10.9 2.5 3.5-1.4 6.7-4.6 6.8-5.3.1-.7-.7-.8-1.1-.3-.6.6-2.2 1.3-4.5.9z"
          />
          <path
            fill="#FF9900"
            d="M20.2 13.9c-.3-.4-1.9-.3-2.9-.1-.3.1-.4-.2-.1-.4 1.8-1.3 4.2-.9 4.6-.4.4.5-.1 3-2 4.4-.3.2-.5.1-.4-.2.4-.9.9-2.8.8-3.3z"
          />
          <path
            fill="#1E293B"
            d="M12.9 6.2c-2.3 0-4.5 1.1-4.5 3.7 0 2.2 1.4 3.4 3.4 3.4 1.5 0 2.6-.8 3.1-1.6v1.3h2.1V6.5h-2.1v1.1c-.5-.9-1.3-1.4-2-1.4zm-.2 5.5c-1.1 0-1.8-.8-1.8-1.9 0-1.2.7-2 1.8-2 1 0 1.7.8 1.7 1.9 0 1.2-.7 2-1.7 2z"
          />
        </svg>
      );

    case "apple":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Apple">
          <path
            fill="currentColor"
            d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.86.96-2.95-.93.04-2.06.62-2.73 1.4-.59.68-1.1 1.77-.96 2.84 1.04.08 2.09-.52 2.73-1.29z"
          />
        </svg>
      );

    case "meta":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Meta">
          <path
            fill="#0668E1"
            d="M12 6.5C8.8 6.5 6.3 8.8 4.8 11.2 3.6 13.1 3 14.8 3 16c0 2.1 1.4 3.5 3.3 3.5 2.5 0 4.5-2.5 5.7-4.5 1.2 2 3.2 4.5 5.7 4.5 1.9 0 3.3-1.4 3.3-3.5 0-1.2-.6-2.9-1.8-4.8C17.7 8.8 15.2 6.5 12 6.5zm0 2.6c2.2 0 4.3 2 5.5 4.1-1.1 1.9-2.7 3.7-4.4 3.7-1 0-1.7-.5-2.2-1.3-.8-1.3-1.2-2.6-1.2-3.8 0-1.5.9-2.7 2.3-2.7zm-2.3 2.7c0 1.2.4 2.5 1.2 3.8.5.8 1.2 1.3 2.2 1.3-1.7 0-3.3-1.8-4.4-3.7 1.2-2.1 3.3-4.1 5.5-4.1-1.4 0-2.3 1.2-2.3 2.7H9.7z"
          />
        </svg>
      );

    case "netflix":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Netflix">
          <path fill="#B81D24" d="M4 1v22h3.5V1z" />
          <path fill="#B81D24" d="M16.5 1v22H20V1z" />
          <path fill="#E50914" d="M4 1l12.5 22H20L7.5 1z" />
        </svg>
      );

    case "adobe":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Adobe">
          <path fill="#FF0000" d="M14.5 2H24v20zM9.5 2H0v20zM12 9.5l4.5 12.5h-3.2l-1.3-3.8h-3.4L12 9.5z" />
        </svg>
      );

    case "bloomberg":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Bloomberg">
          <rect width="24" height="24" rx="5" fill="#1D3461" />
          <text
            x="12"
            y="17"
            fill="#FFFFFF"
            fontSize="15"
            fontWeight="900"
            fontFamily="sans-serif"
            textAnchor="middle"
          >
            B
          </text>
        </svg>
      );

    case "goldman-sachs":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Goldman Sachs">
          <rect width="24" height="24" rx="5" fill="#1E395B" />
          <text
            x="12"
            y="16"
            fill="#72A0C1"
            fontSize="10"
            fontWeight="bold"
            fontFamily="serif"
            textAnchor="middle"
          >
            GS
          </text>
        </svg>
      );

    case "american-express":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="American Express">
          <rect width="24" height="24" rx="5" fill="#006FCF" />
          <text
            x="12"
            y="15.5"
            fill="#FFFFFF"
            fontSize="8.5"
            fontWeight="900"
            fontFamily="sans-serif"
            letterSpacing="-0.5"
            textAnchor="middle"
          >
            AMEX
          </text>
        </svg>
      );

    case "oracle":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Oracle">
          <path
            fill="#F80000"
            d="M16.5 6h-9C4.5 6 2 8.5 2 12s2.5 6 5.5 6h9c3 0 5.5-2.5 5.5-6s-2.5-6-5.5-6zm-.2 9.3h-8.6c-1.8 0-3.3-1.5-3.3-3.3s1.5-3.3 3.3-3.3h8.6c1.8 0 3.3 1.5 3.3 3.3s-1.5 3.3-3.3 3.3z"
          />
        </svg>
      );

    case "salesforce":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Salesforce">
          <path
            fill="#00A1E0"
            d="M10 5.5c1.4-1.2 3.2-1.9 5.2-1.9 4 0 7.3 3 7.7 6.9.7.5 1.1 1.4 1.1 2.3 0 1.6-1.3 2.9-2.9 2.9-.3 0-.6 0-.8-.1-.7 1.8-2.5 3.1-4.6 3.1-1.3 0-2.5-.5-3.4-1.4-.7 1.1-2 1.8-3.4 1.8-2 0-3.7-1.4-4.1-3.3-.3.1-.6.1-.9.1C2 15.9.5 14.4.5 12.6c0-1.6 1.2-3 2.8-3.2.4-2.2 2.3-3.9 4.7-3.9.7 0 1.4.1 2 .4z"
          />
        </svg>
      );

    case "nvidia":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="NVIDIA">
          <rect width="24" height="24" rx="5" fill="#111827" />
          <path
            fill="#76B900"
            d="M8.2 17.5c-2.3 0-4.2-1.8-4.2-4.1 0-2.3 1.9-4.1 4.2-4.1 1.6 0 3 .9 3.7 2.2l1.6-.9c-1.1-1.9-3.1-3.2-5.3-3.2-3.5 0-6.3 2.7-6.3 6s2.8 6 6.3 6c2.5 0 4.6-1.4 5.6-3.4l-1.7-.8c-.7 1.4-2.2 2.3-4 2.3zm4.5-9.3v11.6l4.6-2.5V8.2l-4.6 0z"
          />
        </svg>
      );

    case "uber":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Uber">
          <rect width="24" height="24" rx="5" fill="#000000" />
          <text
            x="12"
            y="16"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            fontFamily="sans-serif"
            textAnchor="middle"
          >
            UBER
          </text>
        </svg>
      );

    case "bytedance":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="ByteDance">
          <rect width="24" height="24" rx="5" fill="#0E131F" />
          <path
            fill="#20D5EC"
            d="M6 6h4v12H6zm6 4h4v8h-4z"
          />
          <path fill="#FE2C55" d="M12 6h4v3h-4z" />
        </svg>
      );

    case "cisco":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Cisco">
          <path fill="#1BA0D7" d="M4 14h2v6H4zm4-4h2v10H8zm4-5h2v15h-2zm4 5h2v10h-2zm4 4h2v6h-2z" />
        </svg>
      );

    case "atlassian":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Atlassian">
          <path
            fill="#0052CC"
            d="M11.6 3.8c-.3.4-.6 1-.6 1.7 0 2.8 2.3 5.1 5.1 5.1h4.1C18.6 6.3 15.3 4 11.6 3.8zm-.8 5.6c-.3.4-.4.8-.4 1.3 0 2.8 2.3 5.1 5.1 5.1h4.1c-1.6-4.3-4.9-6.6-8.8-6.4z"
          />
          <path
            fill="#2684FF"
            d="M12.4 20.2c.3-.4.6-1 .6-1.7 0-2.8-2.3-5.1-5.1-5.1H3.8c1.6 4.3 4.9 6.6 8.6 6.8zm.8-5.6c.3-.4.4-.8.4-1.3 0-2.8-2.3-5.1-5.1-5.1H4.4c1.6 4.3 4.9 6.6 8.8 6.4z"
          />
        </svg>
      );

    case "stripe":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Stripe">
          <rect width="24" height="24" rx="5" fill="#635BFF" />
          <path
            fill="#FFFFFF"
            d="M13.6 10.3c0-.7-.6-1-1.6-1-.9 0-2 .3-2.9.8V7.5c1.1-.5 2.2-.7 3.2-.7 2.6 0 4.2 1.3 4.2 3.4 0 3.3-4.6 2.8-4.6 4.2 0 .8.7 1.1 1.8 1.1 1.1 0 2.4-.4 3.3-1v2.6c-1.1.5-2.4.7-3.6.7-2.7 0-4.4-1.3-4.4-3.5 0-3.5 4.6-2.9 4.6-4z"
          />
        </svg>
      );

    case "flipkart":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="Flipkart">
          <rect width="24" height="24" rx="5" fill="#2874F0" />
          <text
            x="12"
            y="16"
            fill="#FFE11B"
            fontSize="12"
            fontWeight="bold"
            fontFamily="sans-serif"
            fontStyle="italic"
            textAnchor="middle"
          >
            f
          </text>
        </svg>
      );

    default: {
      // Modern 2026 Sleek High-Tech Monogram
      const initials = slug.slice(0, 2).toUpperCase();
      return (
        <div
          className={`${className} rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center font-bold text-white text-xs shadow-sm`}
        >
          {initials}
        </div>
      );
    }
  }
}
