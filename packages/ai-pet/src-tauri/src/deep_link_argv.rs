//! Reconstruct `aipet://` URLs from process argv.
//!
//! On Windows, `cmd` treats `&` as a command separator unless the URL is quoted, so
//! `start aipet://text?tl=a&txt=b` becomes multiple argv entries. The stock deep-link
//! plugin only accepts a single trailing argument and drops the rest.

const SCHEME: &str = "aipet:";

/// Collect deep-link URLs from the current process argv (skips the executable path).
pub fn collect_from_process_args() -> Vec<String> {
    collect_from_args(std::env::args())
}

/// Collect deep-link URLs from an argv iterator (e.g. single-instance callback).
pub fn collect_from_args<I>(args: I) -> Vec<String>
where
    I: IntoIterator,
    I::Item: AsRef<str>,
{
    let args: Vec<String> = args
        .into_iter()
        .map(|arg| arg.as_ref().to_string())
        .collect();
    let args = skip_executable_arg(&args);
    reconstruct_urls(&args)
}

fn skip_executable_arg(args: &[String]) -> &[String] {
    if args.is_empty() {
        return args;
    }

    let first = &args[0];
    if first.starts_with(SCHEME) {
        return args;
    }

    if first.contains(std::path::MAIN_SEPARATOR)
        || first.ends_with(".exe")
        || first.ends_with(".EXE")
    {
        &args[1..]
    } else {
        args
    }
}

fn reconstruct_urls(args: &[String]) -> Vec<String> {
    let mut urls = Vec::new();
    let mut index = 0;

    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with(SCHEME) {
            index += 1;
            continue;
        }

        let mut url = arg.clone();
        index += 1;

        while index < args.len() && is_query_continuation(&args[index]) {
            append_query_fragment(&mut url, &args[index]);
            index += 1;
        }

        if is_valid_deep_link(&url) {
            urls.push(url);
        }
    }

    urls
}

fn append_query_fragment(url: &mut String, fragment: &str) {
    if url.contains('?') {
        if !url.ends_with('&') && !url.ends_with('?') {
            url.push('&');
        }
    } else {
        url.push('?');
    }
    url.push_str(fragment);
}

/// Fragments split off by `cmd` when `&` is unquoted (e.g. `txt=...`, `sid=...`).
fn is_query_continuation(arg: &str) -> bool {
    if arg.starts_with(SCHEME) || arg.starts_with('-') || arg.contains(' ') {
        return false;
    }

    arg.contains('=')
}

fn is_valid_deep_link(url: &str) -> bool {
    url::Url::parse(url)
        .ok()
        .is_some_and(|parsed| parsed.scheme() == "aipet")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_argument_url() {
        let urls = collect_from_args(["ai-pet.exe", "aipet://text?tl=hi&txt=body"]);
        assert_eq!(urls.len(), 1);
        assert!(urls[0].contains("txt=body"));
    }

    #[test]
    fn joins_cmd_split_query_fragments() {
        let urls = collect_from_args([
            "ai-pet.exe",
            "aipet://text?tl=title",
            "txt=long-body",
            "sid=039b1cab-b2e8-4570-8b0b-d67901d074fe",
        ]);
        assert_eq!(urls.len(), 1);
        assert_eq!(
            urls[0],
            "aipet://text?tl=title&txt=long-body&sid=039b1cab-b2e8-4570-8b0b-d67901d074fe"
        );
    }

    #[test]
    fn ignores_non_scheme_args() {
        let urls = collect_from_args(["ai-pet.exe", "--help"]);
        assert!(urls.is_empty());
    }
}
