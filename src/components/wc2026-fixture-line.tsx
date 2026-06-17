export interface WcFixtureLineProps {
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  homeScore90?: number | null
  awayScore90?: number | null
  variant?: 'full' | 'compact'
}

function Crest({ src, size }: { src: string | null; size: 'sm' | 'md' }) {
  if (!src) return null
  const className =
    size === 'sm' ? 'h-4 w-4 object-contain shrink-0' : 'h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} />
  )
}

export function WcFixtureLine({
  homeTeam,
  awayTeam,
  homeCrest,
  awayCrest,
  homeScore90,
  awayScore90,
  variant = 'full',
}: WcFixtureLineProps) {
  const hasScore = homeScore90 !== null && homeScore90 !== undefined && awayScore90 !== null && awayScore90 !== undefined
  const crestSize = variant === 'compact' ? 'sm' : 'md'

  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-0.5">
        <Crest src={homeCrest} size={crestSize} />
        {hasScore ? (
          <>
            <span className="text-[10px] font-bold tabular-nums text-gray-900">{homeScore90}</span>
            <span className="text-[10px] text-gray-400">–</span>
            <span className="text-[10px] font-bold tabular-nums text-gray-900">{awayScore90}</span>
          </>
        ) : (
          <span className="text-[10px] text-gray-400">vs</span>
        )}
        <Crest src={awayCrest} size={crestSize} />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base">
      <Crest src={homeCrest} size={crestSize} />
      <span className="font-medium">{homeTeam}</span>
      {hasScore ? (
        <>
          <span className="font-bold text-lg tabular-nums text-gray-900">{homeScore90}</span>
          <span className="text-gray-400 shrink-0">–</span>
          <span className="font-bold text-lg tabular-nums text-gray-900">{awayScore90}</span>
        </>
      ) : (
        <span className="text-gray-400 shrink-0">vs</span>
      )}
      <span className="font-medium">{awayTeam}</span>
      <Crest src={awayCrest} size={crestSize} />
    </div>
  )
}
