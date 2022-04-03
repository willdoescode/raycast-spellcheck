use fuzzy_matcher::clangd::ClangdMatcher;
use fuzzy_matcher::FuzzyMatcher;

fn main() {
    let mut args = std::env::args();
    let user_word = args.nth(1);

    let words = include_str!("/usr/share/dict/words").split("\n");

    let user_word = match user_word {
        Some(w) => w,
        _ => {
            return;
        }
    };

    let matcher = ClangdMatcher::default();

    for word in words {
        if matcher.fuzzy_match(&user_word, word).is_some() {
            println!("{}", word);
        }
    }
}
