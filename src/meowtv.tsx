import {
  Grid,
  ActionPanel,
  Action,
  Icon,
  Detail,
  showToast,
  Toast,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { search, fetchDetails } from "./api";
import { ContentItem, MovieDetails } from "./types";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
                  target={<MovieDetail id={item.id} title={item.title} />}
                  icon={Icon.Eye}
                />
                <Action.OpenInBrowser
                  title="Watch on MeowTV"
                  url={`https://meowtv.vercel.app/watch/${item.id}`}
                />
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

function MovieDetail({ id, title }: { id: string; title: string }) {
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

  const markdown = `
# ${details.title}

${details.coverImage ? `![Cover](${details.coverImage})\n` : ""}

${details.description || "No description available."}

---

**Year:** ${details.year || "N/A"}
**Score:** ${details.score || "N/A"}
**Type:** ${details.episodes && details.episodes.length > 0 ? "Series" : "Movie"}

${details.episodes && details.episodes.length > 0 ? `## Episodes (${details.episodes.length})\n` + details.episodes.map((ep) => `- S${ep.season}E${ep.number}: ${ep.title}`).join("\n") : ""}
  `;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={details.title}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            title="Watch on MeowTV"
            url={`https://meowtv.vercel.app/watch/${id}`}
          />
          <Action.CopyToClipboard
            title="Copy Link"
            content={`https://meowtv.vercel.app/watch/${id}`}
          />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Title" text={details.title} />
          {details.year && (
            <Detail.Metadata.Label
              title="Year"
              text={details.year.toString()}
            />
          )}
          {details.score && (
            <Detail.Metadata.Label
              title="Score"
              text={details.score.toString()}
            />
          )}
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
