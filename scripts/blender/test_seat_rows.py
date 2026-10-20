"""Run with python3 scripts/blender/test_seat_rows.py; Blender is not required."""
import unittest
from build_national_theatre import seats_for_row


class SeatRowTests(unittest.TestCase):
    def test_stable_ids_ignore_display_labels(self):
        seats = [{'row': 0, 'label': 'renamed'}, {'row': 1, 'label': 'A1'}]
        self.assertEqual(seats_for_row(seats, {'row': 0}), seats[:1])

    def test_legacy_letters_do_not_match_other_rows(self):
        seats = [{'label': 'A1'}, {'label': 'AA1'}, {'label': 'A2'}]
        self.assertEqual(seats_for_row(seats, {'row': 0}), [seats[0], seats[2]])
        self.assertEqual(seats_for_row(seats, {'row': 26}), [seats[1]])

    def test_earlier_ticket_exports_keep_stalls_decks(self):
        seats = [{'label': 'Parterre · 1/1'}, {'label': 'Parterre · 11/1'}]
        self.assertEqual(seats_for_row(seats, {'row': 0, 'ticketRow': '1'}), seats[:1])


if __name__ == '__main__':
    unittest.main()
