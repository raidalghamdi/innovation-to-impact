begin;
drop policy if exists change_requests_reviewers_all on innovation.change_requests;
drop policy if exists change_requests_requester_own on innovation.change_requests;
drop policy if exists change_requests_requester_insert on innovation.change_requests;
drop table if exists innovation.change_requests cascade;
commit;
