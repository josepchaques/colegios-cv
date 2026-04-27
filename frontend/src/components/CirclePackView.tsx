"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { RecommendedSchool } from "@/lib/types";

interface Props {
  schools: RecommendedSchool[];
  selected: RecommendedSchool | null;
  onSelectSchool: (s: RecommendedSchool) => void;
}

const TYPE_COLOR: Record<string, string> = {
  public:     "#3b82f6",
  concertado: "#f59e0b",
  private:    "#8b5cf6",
};

const TYPE_LABEL: Record<string, string> = {
  public:     "Público",
  concertado: "Concertado",
  private:    "Privado",
};

// Score → fill color: red-orange → yellow → green
const scoreColor = d3.scaleSequential(d3.interpolateRdYlGn).domain([0.4, 0.95]);

// Rank medal colors
const MEDAL: Record<number, string> = { 1: "#F59E0B", 2: "#9CA3AF", 3: "#CD7F32" };

interface Tooltip {
  x: number;
  y: number;
  school: RecommendedSchool;
  rank: number;
}

export function CirclePackView({ schools, selected, onSelectSchool }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current || schools.length === 0) return;

    const { width, height } = wrapRef.current.getBoundingClientRect();
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Sort by score desc, attach rank
    const sorted = [...schools].sort((a, b) => b.scores.final - a.scores.final);
    const rankOf = new Map(sorted.map((s, i) => [s.id, i + 1]));

    // Power-scale value: exaggerates small score differences
    const hierarchy = d3.hierarchy<{ children?: RecommendedSchool[] } | RecommendedSchool>({
      children: sorted,
    }).sum((d) => {
      if ("scores" in d) {
        const raw = (d as RecommendedSchool).scores.final;
        return Math.max(0.01, Math.pow(Math.max(0, raw), 5));
      }
      return 0;
    });

    const pack = d3.pack<{ children?: RecommendedSchool[] } | RecommendedSchool>()
      .size([width, height])
      .padding(5);

    const leaves = pack(hierarchy).leaves();
    const g        = svg.append("g");
    const gCircles = g.append("g");  // circles layer (bottom)
    const gLabels  = g.append("g");  // text layer (always on top)

    // Drop shadow filter for top 3
    const defs = svg.append("defs");
    defs.append("filter")
      .attr("id", "glow")
      .append("feDropShadow")
      .attr("dx", 0).attr("dy", 0)
      .attr("stdDeviation", 4)
      .attr("flood-color", "#fbbf24")
      .attr("flood-opacity", 0.7);

    // Circles
    const circles = gCircles.selectAll<SVGCircleElement, d3.HierarchyCircularNode<{ children?: RecommendedSchool[] } | RecommendedSchool>>("circle")
      .data(leaves)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r",  (d) => d.r)
      .attr("fill", (d) => {
        const s = d.data as RecommendedSchool;
        return scoreColor(s.scores.final);
      })
      .attr("fill-opacity", (d) => {
        const s = d.data as RecommendedSchool;
        return selected?.id === s.id ? 1 : 0.82;
      })
      .attr("stroke", (d) => {
        const s = d.data as RecommendedSchool;
        const rank = rankOf.get(s.id) ?? 99;
        if (selected?.id === s.id) return "#1e293b";
        if (rank <= 3) return MEDAL[rank];
        return TYPE_COLOR[s.school_type] ?? "white";
      })
      .attr("stroke-width", (d) => {
        const s = d.data as RecommendedSchool;
        const rank = rankOf.get(s.id) ?? 99;
        if (selected?.id === s.id) return 3;
        if (rank <= 3) return 2.5;
        return 1.2;
      })
      .attr("filter", (d) => {
        const s = d.data as RecommendedSchool;
        const rank = rankOf.get(s.id) ?? 99;
        return rank <= 3 ? "url(#glow)" : null;
      })
      .style("cursor", "pointer");

    // Name labels (circles big enough)
    gLabels.selectAll("text.name")
      .data(leaves.filter((d) => d.r > 20))
      .join("text")
      .attr("class", "name")
      .attr("x", (d) => d.x)
      .attr("y", (d) => {
        const s = d.data as RecommendedSchool;
        const rank = rankOf.get(s.id) ?? 99;
        return d.y + (rank <= 3 && d.r > 30 ? -d.r / 5 : 0);
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .attr("font-size", (d) => Math.min(d.r / 3.2, 11))
      .attr("font-weight", "700")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.5)")
      .text((d) => {
        const s = d.data as RecommendedSchool;
        const name = s.name.replace(/^(CEIP|IES|CIPFP|C\.E\.I\.P\.?)\s*/i, "");
        return name.length > 16 ? name.slice(0, 14) + "…" : name;
      });

    // Score pts (circles big enough)
    gLabels.selectAll("text.score")
      .data(leaves.filter((d) => d.r > 28))
      .join("text")
      .attr("class", "score")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y + d.r / 3.2 + 2)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.9)")
      .attr("font-size", (d) => Math.min(d.r / 4.2, 9))
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .text((d) => {
        const s = d.data as RecommendedSchool;
        return `${Math.round(s.scores.final * 100)} pts`;
      });

    // Rank badge (#1 #2 #3) — shown on top-3 circles big enough
    gLabels.selectAll("text.rank")
      .data(leaves.filter((d) => {
        const s = d.data as RecommendedSchool;
        const rank = rankOf.get(s.id) ?? 99;
        return rank <= 3 && d.r > 22;
      }))
      .join("text")
      .attr("class", "rank")
      .attr("x", (d) => d.x + d.r * 0.55)
      .attr("y", (d) => d.y - d.r * 0.55)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", (d) => {
        const s = d.data as RecommendedSchool;
        return MEDAL[rankOf.get(s.id) ?? 99] ?? "white";
      })
      .attr("font-size", (d) => Math.min(d.r / 2.8, 13))
      .attr("font-weight", "800")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.6)")
      .text((d) => {
        const s = d.data as RecommendedSchool;
        const rank = rankOf.get(s.id) ?? 99;
        return ["🥇", "🥈", "🥉"][rank - 1];
      });

    // Interactions
    circles
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("fill-opacity", 1);
        const s = d.data as RecommendedSchool;
        const rect = wrapRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          school: s,
          rank: rankOf.get(s.id) ?? 99,
        });
      })
      .on("mousemove", function (event) {
        const rect = wrapRef.current!.getBoundingClientRect();
        setTooltip((prev) => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
      })
      .on("mouseleave", function (_, d) {
        const s = d.data as RecommendedSchool;
        d3.select(this).attr("fill-opacity", selected?.id === s.id ? 1 : 0.82);
        setTooltip(null);
      })
      .on("click", (_, d) => onSelectSchool(d.data as RecommendedSchool));

  }, [schools, selected, onSelectSchool]);

  return (
    <div ref={wrapRef} className="w-full h-full relative bg-gray-50 overflow-hidden">
      {schools.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-gray-400">Sin resultados para mostrar</p>
        </div>
      ) : (
        <>
          <svg ref={svgRef} className="w-full h-full" />

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none bg-white rounded-xl shadow-lg px-3 py-2.5 text-xs max-w-[210px]"
              style={{
                left:      tooltip.x + 14,
                top:       tooltip.y - 10,
                transform: tooltip.x > (wrapRef.current?.clientWidth ?? 0) - 230
                  ? "translateX(calc(-100% - 20px))" : undefined,
              }}
            >
              <div className="flex items-start gap-1.5 mb-1">
                {tooltip.rank <= 3 && (
                  <span className="text-base leading-none mt-0.5">
                    {["🥇","🥈","🥉"][tooltip.rank - 1]}
                  </span>
                )}
                <p className="font-bold text-gray-900 leading-snug">
                  {tooltip.school.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-none"
                  style={{ background: TYPE_COLOR[tooltip.school.school_type] }}
                />
                <span className="text-gray-500">{TYPE_LABEL[tooltip.school.school_type]}</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">#{tooltip.rank}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-none"
                  style={{ background: scoreColor(tooltip.school.scores.final) }}
                />
                <span className="font-semibold text-gray-800">
                  {Math.round(tooltip.school.scores.final * 100)} pts
                </span>
              </div>
              {tooltip.school.city && (
                <p className="text-gray-400 mt-1">{tooltip.school.city}</p>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex flex-col gap-2">
            {/* Score gradient */}
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
              <span className="text-[10px] text-gray-500 font-medium">Score:</span>
              <div
                className="w-20 h-2 rounded-full"
                style={{ background: "linear-gradient(to right, #d73027, #fee08b, #1a9850)" }}
              />
              <span className="text-[10px] text-gray-400">bajo → alto</span>
            </div>
            {/* Type legend */}
            <div className="flex gap-2.5 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
              <span className="text-[10px] text-gray-500 font-medium">Borde:</span>
              {Object.entries(TYPE_LABEL).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full border-2 flex-none"
                    style={{ borderColor: TYPE_COLOR[key], background: "transparent" }}
                  />
                  <span className="text-[10px] text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
