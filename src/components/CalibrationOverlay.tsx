import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface CalibrationOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  zoom?: number;
}

export default function CalibrationOverlay({ containerRef, zoom = 1 }: CalibrationOverlayProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, percentX: 0, percentY: 0 });
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Check if mouse is within bounds
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        const percentX = (x / rect.width) * 100;
        const percentY = (y / rect.height) * 100;
        
        setMousePos({ x, y, percentX, percentY });
        setIsTracking(true);
      } else {
        setIsTracking(false);
      }
    };

    const handleMouseLeave = () => {
      setIsTracking(false);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [containerRef]);

  if (!containerRef.current) return null;

  const rect = containerRef.current.getBoundingClientRect();

  return (
    <>
      {/* Scale Bar - Top Left */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <Card className="bg-background/90 backdrop-blur-sm p-3 shadow-lg border-primary/20">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Scale Reference</div>
            <div className="flex items-center gap-2">
              <div className="border-b-2 border-t-2 border-l-2 border-primary h-4 w-24" />
              <span className="text-xs font-mono">100px</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="border-b-2 border-t-2 border-l-2 border-secondary h-4 w-48" />
              <span className="text-xs font-mono">200px</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Crosshair */}
      {isTracking && (
        <>
          {/* Vertical line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary/50 pointer-events-none z-10"
            style={{ left: `${mousePos.x}px` }}
          />
          {/* Horizontal line */}
          <div
            className="absolute left-0 right-0 h-px bg-primary/50 pointer-events-none z-10"
            style={{ top: `${mousePos.y}px` }}
          />
          {/* Center dot */}
          <div
            className="absolute w-2 h-2 rounded-full bg-primary pointer-events-none z-10"
            style={{ 
              left: `${mousePos.x - 4}px`, 
              top: `${mousePos.y - 4}px` 
            }}
          />
        </>
      )}

      {/* Position Readout - Bottom Right */}
      {isTracking && (
        <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
          <Card className="bg-background/90 backdrop-blur-sm p-3 shadow-lg border-primary/20">
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Pixel:</span>
                <span className="font-semibold">
                  X: {mousePos.x.toFixed(0)}px, Y: {mousePos.y.toFixed(0)}px
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Percent:</span>
                <span className="font-semibold">
                  X: {mousePos.percentX.toFixed(2)}%, Y: {mousePos.percentY.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Container:</span>
                <span className="font-semibold">
                  {rect.width.toFixed(0)}px × {rect.height.toFixed(0)}px
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Zoom:</span>
                <span className="font-semibold">{(zoom * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Grid Overlay */}
      <svg 
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-5"
        style={{ width: rect.width, height: rect.height }}
      >
        {/* Vertical grid lines every 10% */}
        {[...Array(11)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${i * 10}%`}
            y1="0%"
            x2={`${i * 10}%`}
            y2="100%"
            stroke="hsl(var(--primary))"
            strokeWidth="0.5"
            strokeOpacity="0.2"
            strokeDasharray={i % 5 === 0 ? "0" : "2,2"}
          />
        ))}
        {/* Horizontal grid lines every 10% */}
        {[...Array(11)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0%"
            y1={`${i * 10}%`}
            x2="100%"
            y2={`${i * 10}%`}
            stroke="hsl(var(--primary))"
            strokeWidth="0.5"
            strokeOpacity="0.2"
            strokeDasharray={i % 5 === 0 ? "0" : "2,2"}
          />
        ))}
        {/* Percentage labels */}
        {[0, 25, 50, 75, 100].map((i) => (
          <text
            key={`label-x-${i}`}
            x={`${i}%`}
            y="12"
            fill="hsl(var(--primary))"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {i}%
          </text>
        ))}
        {[0, 25, 50, 75, 100].map((i) => (
          <text
            key={`label-y-${i}`}
            x="12"
            y={`${i}%`}
            fill="hsl(var(--primary))"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="start"
          >
            {i}%
          </text>
        ))}
      </svg>
    </>
  );
}
