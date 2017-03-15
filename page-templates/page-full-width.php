<?php
/*
Template Name: Full Width
*/
get_header(); ?>



<div id="page-full-width" role="main">


<?php while ( have_posts() ) : the_post(); ?>
  <article>
      <header>
          <h1 class="entry-title"><?php the_title(); ?></h1>
      </header>
      <div class="entry-content">
          <?php the_content(); ?>
      </div>
<<<<<<< HEAD
=======
      <footer>
          <?php
            wp_link_pages(
              array(
                'before' => '<nav id="page-nav"><p>' . __( 'Pages:', 'foundationpress' ),
                'after'  => '</p></nav>',
              )
            );
          ?>
          <p><?php the_tags(); ?></p>
      </footer>
      <?php do_action( 'foundationpress_page_before_comments' ); ?>
      <?php comments_template(); ?>
      <?php do_action( 'foundationpress_page_after_comments' ); ?>
>>>>>>> c067a86f5e526ab35eb48a25577ddc07f372e181
  </article>
<?php endwhile;?>

</div>

<?php get_footer();
