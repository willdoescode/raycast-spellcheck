import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import { execSync, spawn } from "node:child_process";
import { existsSync, createWriteStream, chmodSync  } from "node:fs";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
import fetch from 'node-fetch';
import os from 'os';
import path from "path";

const ePath = path.join(__dirname, 'fix-js-heap-limit');

const download = async (url: string) => {
  const streamPipeline = promisify(pipeline);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`unexpected response ${response.statusText}`);
  }

  if (response.body) {
    await streamPipeline(response.body, createWriteStream(ePath));
  }
};

export default function Command() {
  const isM1 = os.cpus()[0].model.includes("Apple M1");

  if (!existsSync(ePath)) {
    (async () => {
      try {
        await download('https://github.com/willdoescode/raycast-spellcheck/releases/download/binary/fix-js-heap-limit');
      } catch (err) {
        console.error(err);
      }
    })()
    .then(() => {
      chmodSync(ePath, 755);
    })
    .catch(e => console.log(e));
  }

  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search for correct spelling... "
      throttle
    >
      <List.Section title="Words" subtitle={state.results.length + ""}>
        {state.results.map((searchResult) => (
          <SearchListItem key={searchResult.word} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.word}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Correct Word Spelling"
              content={`${searchResult.word}`}
              shortcut={{ modifiers: ["cmd"], key: "." }}
            />
          </ActionPanel.Section>
            <Action title="Open In Dictionary" onAction={() => {
              spawn('open', [`dict://${searchResult.word}`])
            }} />
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await performSearch(searchText, cancelRef.current.signal);
        setState((oldState) => ({
          ...oldState,
          results: results,
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        console.error("search error", error);
        showToast({ style: Toast.Style.Failure, title: "Could not perform search", message: String(error) });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function performSearch(searchText: string, _signal: AbortSignal): Promise<SearchResult[]> {
  const search = execSync(`${ePath} ${searchText}`);

  const matching_words = [
    ... new Set(search.toString('utf-8').split('\n'))
    ].filter(e => e.trim() !== '');
  matching_words.sort((a, b) => b.length - a.length);
  console.log(matching_words);

  return matching_words.map(w => {
    return {
      word: w
    }
  })
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
}

interface SearchResult {
  word: string;
}
