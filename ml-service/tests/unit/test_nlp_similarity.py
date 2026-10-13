from app.pipelines.nlp.similarity import keyword_coverage, similarity_score


def test_similarity_score_ranks_relevant_answer_higher():
    reference = "array,linked list,index,insertion,memory,contiguous"
    relevant = ("An ArrayList is backed by a dynamic array offering fast index-based access, "
                "while a LinkedList uses nodes with pointers.")
    irrelevant = "I really enjoy playing football on weekends with my friends."

    relevant_score = similarity_score(relevant, reference)
    irrelevant_score = similarity_score(irrelevant, reference)

    assert relevant_score > irrelevant_score


def test_similarity_score_empty_input_is_zero():
    assert similarity_score("", "some reference text") == 0.0
    assert similarity_score("some text", "") == 0.0


def test_keyword_coverage_counts_matches():
    text = "I used arrays and hashing to solve this efficiently."
    coverage = keyword_coverage(text, ["arrays", "hashing", "graphs"])
    assert coverage == pytest_approx(66.7)


def pytest_approx(value, tol=0.5):
    class _Approx:
        def __eq__(self, other):
            return abs(other - value) <= tol
    return _Approx()
