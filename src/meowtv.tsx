import {
  Grid,
  ActionPanel,
  Action,
  Icon,
  Detail,
  showToast,
  Toast,
  getApplications,
  open,
  confirmAlert,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { search, fetchDetails, fetchStreamUrl } from "./api";
import { ContentItem, MovieDetails, Episode } from "./types";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVlcInstalled, setIsVlcInstalled] = useState(false);

  useEffect(() => {
    async function checkVlc() {
      const apps = await getApplications();
      setIsVlcInstalled(apps.some((app) => app.name.toLowerCase().includes("vlc")));
    }
    checkVlc();
  }, []);

  useEffect(() => {
    async function performSearch() {
      if (!searchText) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const data = await search(searchText);
        setResults(data);
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Search failed",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    performSearch();
  }, [searchText]);

  return (
    <Grid
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search movies and TV shows on MeowTV..."
      throttle
      columns={5}
      aspectRatio="2/3"
      fit={Grid.Fit.Fill}
    >
      <Grid.Section title="Results" subtitle={`${results.length}`}>
        {results.map((item) => (
          <Grid.Item
            key={item.id}
            title={item.title}
            subtitle={item.type}
            content={{ source: item.coverImage || Icon.Video }}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Details"
                  target={<MovieDetail id={item.id} title={item.title} isVlcInstalled={isVlcInstalled} />}
                  icon={Icon.Eye}
                />
                 {item.type === "movie" ? (
                   <WatchAction id={item.id} isVlcInstalled={isVlcInstalled} />
                 ) : (
                   <Action.Push
                     title="Select Season"
                     target={<SeasonSelector id={item.id} title={item.title} isVlcInstalled={isVlcInstalled} />}
                     icon={Icon.List}
                   />
                 )}
                 <Action.CopyToClipboard
                   title="Copy Link"
                   content={`https://meowtv.vercel.app/watch/${item.id}`}
                 />
               </ActionPanel>
             }
           />
         ))}
       </Grid.Section>
     </Grid>
   );
 }

function MovieDetail({
  id,
  title,
  isVlcInstalled,
}: {
  id: string;
  title: string;
  isVlcInstalled: boolean;
}) {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDetails() {
      try {
        const data = await fetchDetails(id);
        setDetails(data);
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load details",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadDetails();
  }, [id]);

  if (isLoading) {
    return <Detail isLoading={true} />;
  }

  if (!details) {
    return <Detail markdown={`# Failed to load details for ${title}`} />;
  }

  const isSeries = details.episodes && details.episodes.length > 0;

  const markdown = `
# ${details.title}

${details.coverImage ? `![Cover](${details.coverImage})\n` : ""}

${details.description || "No description available."}

---

**Year:** ${details.year || "N/A"}
**Score:** ${details.score || "N/A"}
**Type:** ${isSeries ? "Series" : "Movie"}

${isSeries ? `## Episodes (${details.episodes?.length})\n` + details.episodes?.slice(0, 10).map((ep) => `- S${ep.season}E${ep.number}: ${ep.title}`).join("\n") + (details.episodes && details.episodes.length > 10 ? "\n- ..." : "") : ""}
  `;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={details.title}
       actions={
         <ActionPanel>
           {isSeries ? (
             <Action.Push
               title="Select Season"
               target={
                 <SeasonSelector
                   id={id}
                   title={details.title}
                   isVlcInstalled={isVlcInstalled}
                   preloadedEpisodes={details.episodes}
                 />
               }
               icon={Icon.List}
             />
           ) : (
             <WatchAction id={id} isVlcInstalled={isVlcInstalled} />
           )}
           <Action.CopyToClipboard title="Copy Page Link" content={`https://meowtv.vercel.app/watch/${id}`} />
         </ActionPanel>
       }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Title" text={details.title} />
          {details.year && <Detail.Metadata.Label title="Year" text={details.year.toString()} />}
          {details.score && <Detail.Metadata.Label title="Score" text={details.score.toString()} />}
          {details.tags && (
            <Detail.Metadata.TagList title="Tags">
              {details.tags.map((tag) => (
                <Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </Detail.Metadata.TagList>
          )}
        </Detail.Metadata>
      }
    />
  );
}

 function SeasonSelector({
   id,
   title,
   isVlcInstalled,
   preloadedEpisodes,
 }: {
   id: string;
   title: string;
   isVlcInstalled: boolean;
   preloadedEpisodes?: Episode[];
 }) {
   const [episodes, setEpisodes] = useState<Episode[]>(preloadedEpisodes || []);
   const [isLoading, setIsLoading] = useState(!preloadedEpisodes);
 
   useEffect(() => {
     if (preloadedEpisodes) return;
     async function loadEpisodes() {
       try {
         const details = await fetchDetails(id);
         if (details) {
           setEpisodes(details.episodes || []);
         }
       } catch (error) {
         showToast({
           style: Toast.Style.Failure,
           title: "Failed to load episodes",
           message: String(error),
         });
       } finally {
         setIsLoading(false);
       }
     }
     loadEpisodes();
   }, [id, preloadedEpisodes]);
 
   const seasons = [...new Set(episodes.map((ep) => ep.season))].sort((a, b) => a - b);
 
   return (
     <Grid
       isLoading={isLoading}
       columns={4}
       aspectRatio="16/9"
       fit={Grid.Fit.Fill}
       navigationTitle={`${title} - Seasons`}
     >
       {seasons.map((season) => (
         <Grid.Item
           key={season}
           title={`Season ${season}`}
           content={Icon.Folder}
           actions={
             <ActionPanel>
               <Action.Push
                 title="View Episodes"
                 target={
                   <EpisodeSelector
                     id={id}
                     title={title}
                     isVlcInstalled={isVlcInstalled}
                     season={season}
                     allEpisodes={episodes}
                   />
                 }
                 icon={Icon.List}
               />
             </ActionPanel>
           }
         />
       ))}
     </Grid>
   );
 }
 
 function EpisodeSelector({
   id,
   title,
   isVlcInstalled,
   season,
   allEpisodes,
 }: {
   id: string;
   title: string;
   isVlcInstalled: boolean;
   season: number;
   allEpisodes: Episode[];
 }) {
   const episodes = allEpisodes.filter((ep) => ep.season === season);
 
   return (
     <Grid columns={4} aspectRatio="16/9" fit={Grid.Fit.Fill} navigationTitle={`${title} - Season ${season}`}>
       {episodes.map((ep) => (
         <Grid.Item
           key={`${ep.season}-${ep.number}`}
           title={`Episode ${ep.number}`}
           subtitle={ep.title}
           content={Icon.Video}
           actions={
             <ActionPanel>
               <WatchAction
                 id={id}
                 episodeId={ep.id}
                 isVlcInstalled={isVlcInstalled}
                 season={ep.season}
                 episode={ep.number}
               />
               <Action.CopyToClipboard
                 title="Copy Link"
                 content={`https://meowtv.vercel.app/watch/${id}?s=${ep.season}&e=${ep.number}`}
               />
             </ActionPanel>
           }
         />
       ))}
     </Grid>
   );
 }

 function WatchAction({
   id,
   episodeId,
   isVlcInstalled,
   season,
   episode,
 }: {
   id: string;
   episodeId?: string;
   isVlcInstalled: boolean;
   season?: number;
   episode?: number;
 }) {
   const watchUrl = `https://meowtv.vercel.app/watch/${id}${season ? `?s=${season}${episode ? `&e=${episode}` : ""}` : ""}`;
 
   const watchInVlc = async () => {
     const toast = await showToast({
       style: Toast.Style.Animated,
       title: "Fetching stream URL...",
     });
     try {
       const stream = await fetchStreamUrl(id, episodeId);
       if (stream && stream.videoUrl) {
         toast.hide();
         try {
           await open(stream.videoUrl, "VLC");
         } catch {
           await open(stream.videoUrl);
         }
       } else {
         throw new Error("No stream URL found. Try watching on website.");
       }
     } catch (error) {
       toast.style = Toast.Style.Failure;
       toast.title = "Playback Error";
       toast.message = String(error);
     }
   };
 
   return (
     <Action
       title="Watch Now"
       icon={Icon.Play}
       onAction={async () => {
         if (isVlcInstalled) {
           const confirmed = await confirmAlert({
             title: "Watch on VLC?",
             message: "Would you like to play this in VLC or open it in your browser?",
             primaryAction: { title: "VLC Player" },
             dismissAction: { title: "Web Browser" },
           });
           if (confirmed) {
             await watchInVlc();
           } else {
             await open(watchUrl);
           }
         } else {
           await open(watchUrl);
         }
       }}
     />
   );
 }
