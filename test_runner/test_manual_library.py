"""Zero-provider checks for the real library inventory and registry builder."""
import copy
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_manual_library import canonical, scope_matches, expanded_registry
from build_manual_page_index import validate_registry, RegistryValidationError, order_page_blocks
from resolve_manual_library import candidates
import json


class LibraryContracts(unittest.TestCase):
    def test_two_columns_never_interleave_limits(self):
        blocks=[(40,80,390,90,"Left setting",0,0),(150,100,390,110,"Only model A",1,0),
                (40,120,390,130,"Left next",2,0),(430,70,790,90,"Support",3,0),
                (430,95,790,105,"Self Diagnosis Self Diagnosis Test",4,0),(550,115,790,125,"Do not turn off",5,0),
                (430,135,790,145,"Software Update Software Update USB",6,0),(550,155,790,165,"Only model B",7,0)]
        ordered,sections=order_page_blocks(blocks,842)
        self.assertEqual([b[5] for b in ordered],list(range(8)))
        self.assertEqual(sections[4]["id"],sections[5]["id"])
        self.assertNotEqual(sections[5]["id"],sections[6]["id"])
        self.assertEqual(sections[4]["heading"],"Support")

    def test_region_prefix_and_cover_only(self):
        self.assertEqual(canonical("LF24T350FHCXZW"), "F24T350FHC")
        self.assertTrue(scope_matches("S32DM70*", "S32DM703UC"))
        self.assertFalse(scope_matches("S32DM70*", "S32CM703UC"))
        self.assertFalse(scope_matches("S32DM702", "S32CM703UC"))
        self.assertFalse(scope_matches("S32DM702", "S32DM703UC"))
        self.assertTrue(scope_matches("S32DM702", "S32DM702UC"))

    def test_conflicting_proposals_never_activated(self):
        registry={"schemaVersion":2,"documents":[]}
        result={"documents":[],"bindings":{},"unresolved":[{"model":"S32DM703UC","reason":"multiple_revisions"}]}
        self.assertEqual(expanded_registry(result,registry)["documents"],[])

    def test_um_new_product_guide_does_not_override_user_manual(self):
        base={"contentsTypeCode":"UM","areaList":[{"orgCode":"TW"}],"languageList":[{"orgCode":"ZH2"}],
              "downloadUrl":"https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_TW&CDCttType=UM"}
        guide=dict(base,fileName="BN81_WPG_M7.pdf",fileModifiedDateCalendar=99999)
        manual=dict(base,fileName="BN81_EUG_M7.pdf",fileModifiedDateCalendar=1)
        self.assertEqual(candidates(json.dumps({"manuals":[guide,manual]})),[dict(manual,priority=0)])

    def test_real_registry_unique_models_and_hashes(self):
        root=Path(__file__).resolve().parents[1]
        registry=json.loads((root/"config/manual_registry.json").read_text(encoding="utf-8"))
        validate_registry(registry,root/"三星螢幕使用手冊")
        tampered=copy.deepcopy(registry)
        cover=next(d for d in tampered["documents"] if d.get("bindingPolicy")=="unique_printed_cover_v1")
        cover["models"]=["S99ZZ999"]
        with self.assertRaises(RegistryValidationError):
            validate_registry(tampered,root/"三星螢幕使用手冊")


if __name__ == "__main__":
    unittest.main()
